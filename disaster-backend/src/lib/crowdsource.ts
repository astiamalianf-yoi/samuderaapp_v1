import { redis } from "./redis";

const QUEUE_PREFIX = "reports:queue";
const WARNING_PREFIX = "warnings:active";

export type ActiveWarning = {
	codes: string[];
	triggeredAt: number;
	alertId: string;
	alertEvent?: Record<string, unknown>;
};

const REPEAT_PREFIX = "reports:recent";

/** Default: the same reporter repeating the same sign at the same beach within 5 minutes counts once. */
export const DEFAULT_REPEAT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Stable identity of the person behind a report, shared by every channel.
 * - logged-in app user: "user:<jwt sub>"
 * - anonymous app install: "device:<uuid kept in the phone>"
 * - WhatsApp sender: "wa:<phone digits>"
 * Returns null when the channel gives no identity; such a report is always counted.
 */
export function reporterKeyFor(opts: {
	userId?: string | null;
	deviceId?: string | null;
	waSender?: string | null;
}): string | null {
	if (opts.userId) return `user:${opts.userId}`;
	if (opts.deviceId && /^[0-9a-z-]{8,64}$/i.test(opts.deviceId)) return `device:${opts.deviceId.toLowerCase()}`;
	if (opts.waSender) {
		// "6281234567890@s.whatsapp.net", "+62 812-3456-7890" -> "6281234567890"; group ids are not a person.
		if (/@g\.us$/i.test(opts.waSender)) return null;
		const digits = opts.waSender.split("@")[0]!.replace(/\D/g, "");
		if (digits.length >= 6) return `wa:${digits}`;
	}
	return null;
}

/** Reporter part of a queue member ("<reporterKey>|<uuid>"); old members are a bare uuid. */
function memberReporter(member: string): string {
	const i = member.lastIndexOf("|");
	return i > 0 ? member.slice(0, i) : member;
}

/**
 * Adds one report to the per-(beach, sign) queues and checks the threshold.
 * Reports from the app and from WhatsApp go into the same queues. When the reporter is known,
 * the same reporter sending the same sign for the same beach again within `repeatWindowMs`
 * is not counted again (the code is returned in `duplicateCodes`).
 */
export async function processReport(
	beachLocation: string,
	likCodes: string[],
	windowMs: number,
	threshold: number,
	reporterKey: string | null = null,
	repeatWindowMs: number = DEFAULT_REPEAT_WINDOW_MS,
): Promise<{ triggeredCodes: string[]; codeCounts: Record<string, number>; duplicateCodes: string[] }> {
	const now = Date.now();
	const windowStart = now - windowMs;
	const triggeredCodes: string[] = [];
	const duplicateCodes: string[] = [];
	const codeCounts: Record<string, number> = {};

	for (const code of likCodes) {
		const codeKey = code.toLowerCase();
		const key = `${QUEUE_PREFIX}:${beachLocation}:${codeKey}`;

		let counted = true;
		if (reporterKey && repeatWindowMs > 0) {
			const fresh = await redis.set(`${REPEAT_PREFIX}:${beachLocation}:${codeKey}:${reporterKey}`, String(now), {
				NX: true,
				PX: repeatWindowMs,
			});
			counted = fresh === "OK";
		}

		if (counted) {
			const member = `${reporterKey ?? "anon"}|${crypto.randomUUID()}`;
			await redis.zAdd(key, { score: now, value: member });
		} else {
			duplicateCodes.push(code);
		}
		await redis.zRemRangeByScore(key, 0, windowStart);
		const count = await redis.zCard(key);

		codeCounts[code] = count;

		if (counted && count >= threshold) {
			triggeredCodes.push(code);
		}
	}

	return { triggeredCodes, codeCounts, duplicateCodes };
}

/**
 * Number of different people behind the queued reports of these signs (for "Dilaporkan oleh N
 * nelayan"). Anonymous reports each count as one person. Call before resetQueues().
 */
export async function countReporters(beachLocation: string, codes: string[]): Promise<number> {
	const people = new Set<string>();
	let anonymous = 0;
	for (const code of codes) {
		const members = await redis.zRange(`${QUEUE_PREFIX}:${beachLocation}:${code.toLowerCase()}`, 0, -1);
		for (const m of members) {
			const who = memberReporter(m);
			if (who === "anon" || who === m) anonymous += 1;
			else people.add(who);
		}
	}
	return people.size + anonymous;
}

export async function getReportTimeRange(
	beachLocation: string,
	codes: string[],
): Promise<{ firstReportAt: number; lastReportAt: number }> {
	let minTs = Infinity;
	let maxTs = 0;
	for (const code of codes) {
		const key = `${QUEUE_PREFIX}:${beachLocation}:${code.toLowerCase()}`;
		const earliest = await redis.zRangeWithScores(key, 0, 0);
		const latest = await redis.zRangeWithScores(key, -1, -1);
		if (earliest.length > 0) {
			if (earliest[0].score < minTs) minTs = earliest[0].score;
		}
		if (latest.length > 0) {
			if (latest[0].score > maxTs) maxTs = latest[0].score;
		}
	}
	return {
		firstReportAt: minTs === Infinity ? Date.now() : minTs,
		lastReportAt: maxTs === 0 ? Date.now() : maxTs,
	};
}

export async function resetQueues(beachLocation: string, codes: string[]): Promise<void> {
	for (const code of codes) {
		const key = `${QUEUE_PREFIX}:${beachLocation}:${code.toLowerCase()}`;
		await redis.del(key);
	}
}

export async function getActiveWarning(beachLocation: string): Promise<ActiveWarning | null> {
	const key = `${WARNING_PREFIX}:${beachLocation}`;
	const val = await redis.get(key);
	if (!val) return null;
	try {
		return JSON.parse(val) as ActiveWarning;
	} catch {
		return null;
	}
}

export async function setActiveWarning(
	beachLocation: string,
	codes: string[],
	alertId: string,
	ttlSeconds: number,
	alertEvent?: Record<string, unknown>,
): Promise<void> {
	const key = `${WARNING_PREFIX}:${beachLocation}`;
	const warning: ActiveWarning = {
		codes,
		triggeredAt: Date.now(),
		alertId,
		...(alertEvent ? { alertEvent } : {}),
	};
	await redis.set(key, JSON.stringify(warning), { EX: ttlSeconds });
}
