import { redis } from "./redis";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { BEACH_DISPLAY } from "./whatsapp-commands";
import { formatAllClear, type MsgLevel } from "./warning-message";

/**
 * The one-time AMAN message (agreed 23 Nov 2026, Warning Strategy Matrix row 1): when a warning that
 * was sent to a beach group (WASPADA, SIAGA or BAHAYA) has ended and the beach is back to AMAN, the
 * group gets "AMAN - Peringatan … sudah berakhir" once. Nothing is sent when the level only drops
 * (e.g. SIAGA -> WASPADA), and nothing for a BMKG forecast alone (it was never sent).
 */
const KEY = (beach: string) => `wa:warned:${beach}`;
const RANK: Record<MsgLevel, number> = { NORMAL: 0, WASPADA: 1, SIAGA: 2, EKSTREM: 3 };

/** Records that a warning at this level was sent to the beach group (keeps the highest level). */
export async function markWarned(beach: string, level: MsgLevel, now = Date.now()) {
	if (level === "NORMAL") return;
	const raw = await redis.get(KEY(beach)).catch(() => null);
	const prev = raw ? (JSON.parse(raw) as { level: MsgLevel; at: number }) : null;
	const keep = prev && RANK[prev.level] > RANK[level] ? prev.level : level;
	await redis.set(KEY(beach), JSON.stringify({ level: keep, at: now }), { EX: 2 * 24 * 3600 });
}

type Deps = {
	statusOf?: (beach: string) => Promise<{ level: string }>;
	send?: (beach: string, text: string) => Promise<void>;
};

/** One pass: beaches with a sent warning that are now AMAN get the AMAN message once. */
export async function runAllClearCheck(deps: Deps = {}, now = Date.now()) {
	const statusOf = deps.statusOf ?? (async (b: string) => (await import("./map-status")).beachStatus(b));
	const send = deps.send ?? (async (b: string, t: string) => (await import("./openclaw")).sendOpenClawBeachAlert(b, t));
	let sent = 0;
	for (const beach of ALLOWED_BEACH_LOCATIONS) {
		const raw = await redis.get(KEY(beach)).catch(() => null);
		if (!raw) continue;
		const st = await statusOf(beach).catch(() => null);
		if (!st || st.level !== "NORMAL") continue;
		const { level } = JSON.parse(raw) as { level: MsgLevel };
		// Claim it first, so two passes never send it twice.
		if ((await redis.del(KEY(beach))) !== 1) continue;
		await send(beach, formatAllClear(BEACH_DISPLAY[beach] ?? beach, level, now)).catch(() => undefined);
		sent += 1;
	}
	return sent;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startAllClearMonitor(intervalMs = 60_000) {
	if (timer) return;
	timer = setInterval(() => {
		runAllClearCheck().catch((e) => console.error("[all-clear] check failed", e instanceof Error ? e.message : e));
	}, intervalMs);
}
