import type { ActiveWarning } from "./crowdsource";

const RANK: Record<string, number> = { NORMAL: 0, AMAN: 0, WASPADA: 1, SIAGA: 2, EKSTREM: 3, BAHAYA: 3 };
const rank = (v: unknown) => RANK[String(v ?? "").toUpperCase()] ?? 0;

export type NotifyDecision = { notify: boolean; reason: "first" | "new_sign" | "level_up" | "no_change"; newCodes: string[] };

/**
 * While a fishermen's warning is active at a beach, new reports only notify again (WhatsApp group,
 * push, buzzer) when something changed: a sign that is not yet in the warning, or a higher level.
 * Otherwise the warning is updated quietly (app, end time). Decision of 14 Nov 2026 (option 1).
 */
export function notifyDecision(existing: ActiveWarning | null, triggeredCodes: string[], newLevel: string): NotifyDecision {
	if (!existing) return { notify: true, reason: "first", newCodes: [...triggeredCodes] };
	const known = new Set(existing.codes ?? []);
	const newCodes = triggeredCodes.filter((c) => !known.has(c));
	if (newCodes.length > 0) return { notify: true, reason: "new_sign", newCodes };
	const ev = (existing.alertEvent ?? {}) as Record<string, any>;
	const prevDistributed = ev.decision?.shouldDistribute ?? true;
	const prevLevel = prevDistributed ? (ev.decision?.final_risk_level ?? ev.riskLevel) : "NORMAL";
	if (rank(newLevel) > rank(prevLevel)) return { notify: true, reason: "level_up", newCodes };
	return { notify: false, reason: "no_change", newCodes };
}
