import { OPENCLAW_BEACH_GROUPS, OPENCLAW_BROADCAST_GROUPS } from "../config";
import { redis } from "./redis";

const OUTBOUND_STREAM = "openclaw:outbound";

type GroupConfig = { beachGroups: Record<string, string[]>; broadcast: string[] };
const defaultConfig = (): GroupConfig => ({ beachGroups: OPENCLAW_BEACH_GROUPS, broadcast: OPENCLAW_BROADCAST_GROUPS });

/**
 * WhatsApp groups of one beach. With per-beach groups configured, only that beach's own groups
 * (none if it has no group), so a neighbouring beach never receives another beach's warning.
 * Without them, the shared broadcast groups.
 */
export function groupsForBeach(beach: string, cfg: GroupConfig = defaultConfig()): string[] {
	if (Object.keys(cfg.beachGroups).length === 0) return cfg.broadcast;
	return cfg.beachGroups[beach] ?? [];
}

/** Group -> the beaches it covers, for messages that concern several beaches (BMKG warnings). */
export function beachesByGroup(beaches: string[], cfg: GroupConfig = defaultConfig()): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const beach of beaches) {
		for (const g of groupsForBeach(beach, cfg)) {
			const list = out.get(g) ?? [];
			if (!list.includes(beach)) list.push(beach);
			out.set(g, list);
		}
	}
	return out;
}

/** The beach of a beach group (null for a shared group or a group covering several beaches). */
export function beachForGroup(group: string | undefined, cfg: GroupConfig = defaultConfig()): string | null {
	if (!group) return null;
	const beaches = Object.entries(cfg.beachGroups).filter(([, gs]) => gs.includes(group)).map(([b]) => b);
	return beaches.length === 1 ? beaches[0]! : null;
}

/** Queues one message to the given WhatsApp groups (sent by openclaw-bridge). */
export async function sendOpenClawToGroups(groups: string[], text: string): Promise<void> {
	const targets = [...new Set(groups.filter(Boolean))];
	if (targets.length === 0) {
		console.log(`[openclaw] no WhatsApp group configured, not sent: ${(text || "").substring(0, 60)}`);
		return;
	}
	await redis.xAdd(OUTBOUND_STREAM, "*", {
		text,
		target: targets.join(","),
		timestamp: String(Date.now()),
		type: "broadcast",
	});
	console.log(`[openclaw] queued to ${targets.length} group(s): ${(text || "").substring(0, 60)}`);
}

/** A warning (or help request) about one beach: only that beach's group(s). */
export async function sendOpenClawBeachAlert(beach: string, text: string): Promise<void> {
	await sendOpenClawToGroups(groupsForBeach(beach), text);
}

/** Every configured group (all beach groups, or the broadcast groups). */
export function allGroups(cfg: GroupConfig = defaultConfig()): string[] {
	const per = Object.values(cfg.beachGroups).flat();
	return [...new Set(per.length ? per : cfg.broadcast)];
}

/** @deprecated a message to every group; use sendOpenClawBeachAlert for anything about one beach. */
export async function sendOpenClawAlert(text: string): Promise<void> {
	await sendOpenClawToGroups(allGroups(), text);
}

export async function sendOpenClawReply(toChatId: string, text: string): Promise<void> {
	await redis.xAdd(OUTBOUND_STREAM, "*", {
		text,
		target: toChatId,
		timestamp: String(Date.now()),
		type: "reply",
	});
	console.log(`[openclaw] queued reply to ${toChatId}: ${(text || "").substring(0, 60)}`);
}
