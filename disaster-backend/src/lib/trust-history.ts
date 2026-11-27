import { desc } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { trustIndexHistory } from "../db/schema";
import { currentTrustIndex, type TrustIndexResult } from "./trust-index";

/**
 * History of the adaptive Trust Index for the field study (Paper 4, 26 Nov 2026): how often the
 * score and the tier (High / Low / Unranked) of each sign change, and whether a sign moves between
 * tiers. A row is written only when something changed since the last row (scores rounded to .1).
 */
const compact = (r: TrustIndexResult) =>
	r.signs.map((s) => ({ code: s.code, trustIndex: Math.round(s.trustIndex * 10) / 10, accuracy: Math.round(s.accuracy * 10) / 10, records: s.records, appRecords: s.appRecords, tier: s.tier }));
const key = (signs: ReturnType<typeof compact>) => JSON.stringify([...signs].sort((a, b) => a.code.localeCompare(b.code)).map((s) => [s.code, s.trustIndex, s.tier]));

export function recordTrustIndex(result: TrustIndexResult = currentTrustIndex()): boolean {
	const signs = compact(result);
	const db = getDb();
	const last = db.select().from(trustIndexHistory).orderBy(desc(trustIndexHistory.id)).limit(1).get();
	if (last && key(last.signs as ReturnType<typeof compact>) === key(signs) && last.mode === result.mode) return false;
	db.insert(trustIndexHistory).values({ mode: result.mode, high: result.high, low: result.low, signs }).run();
	return true;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startTrustIndexLogger(everyMinutes = Number(process.env.TRUST_HISTORY_MINUTES ?? 60)) {
	if (timer || !(everyMinutes > 0)) return;
	const run = () => { try { recordTrustIndex(); } catch (err) { console.error("[trust-history]", err instanceof Error ? err.message : err); } };
	setTimeout(run, 45_000);
	timer = setInterval(run, everyMinutes * 60_000);
}
