import { desc, eq } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { warningLevelHistory } from "../db/schema";
import { beachStatus, toLevelIndex, type BeachStatus } from "./map-status";
import { getSimWeather, listSimWarnings } from "./bmkg-sim";
import { SNAPSHOT_BEACHES } from "./bmkg-snapshot";

/**
 * History of the community warning level per field beach (Paper 4, 26 Nov 2026): one row each
 * time the level or one of its inputs changes, with what changed, so that a warning can be
 * followed as it rises or falls (a new report, more reporters, other signs, a longer end time,
 * the BMKG forecast, an official warning starting or ending, or the warning expiring).
 * Checked every minute; the community level is the one of the Beranda card and the Peta page,
 * without the personal strategy of a fisherman.
 */
type Row = typeof warningLevelHistory.$inferInsert;

export function rowFromStatus(st: BeachStatus, simulated = false): Row {
	return {
		beach: st.beach,
		level: st.level,
		cause: "",
		likLevel: st.lik?.level ?? null,
		likCodes: st.lik ? [...st.lik.codes].sort() : null,
		likReporters: st.lik?.reporters ?? null,
		likEndsAt: st.lik?.endsAt ? Math.round(st.lik.endsAt / 60_000) * 60_000 : null,
		bmkgLevel: st.bmkg.level,
		forecastLevel: st.bmkg.forecastLevel ?? null,
		official: st.bmkg.warnings.map((w) => w.event).sort(),
		windKmh: st.bmkg.windSpeed,
		simulated,
	};
}

/** What changed between the last logged row and the new one ("" when nothing changed). */
export function causeOf(prev: Partial<Row> | null, next: Row): string {
	const c: string[] = [];
	const up = (a: unknown, b: unknown) => toLevelIndex(b) > toLevelIndex(a);
	const down = (a: unknown, b: unknown) => toLevelIndex(b) < toLevelIndex(a);
	const p = prev ?? { level: "NORMAL", likLevel: null, likCodes: null, likReporters: null, likEndsAt: null, forecastLevel: "NORMAL", official: [] };
	if (!p.likLevel && next.likLevel) c.push("lik_started");
	else if (p.likLevel && !next.likLevel) c.push("lik_ended");
	else if (p.likLevel && next.likLevel) {
		if (up(p.likLevel, next.likLevel)) c.push("lik_up");
		if (down(p.likLevel, next.likLevel)) c.push("lik_down");
		if ((next.likReporters ?? 0) > (p.likReporters ?? 0)) c.push("reporters_up");
		if (JSON.stringify(p.likCodes ?? []) !== JSON.stringify(next.likCodes ?? [])) c.push("signs_changed");
		if ((next.likEndsAt ?? 0) !== (p.likEndsAt ?? 0)) c.push("end_time_changed");
	}
	if (up(p.forecastLevel, next.forecastLevel)) c.push("forecast_up");
	if (down(p.forecastLevel, next.forecastLevel)) c.push("forecast_down");
	const po = (p.official ?? []) as string[]; const no = next.official ?? [];
	if (!po.length && no.length) c.push("official_started");
	else if (po.length && !no.length) c.push("official_ended");
	else if (JSON.stringify(po) !== JSON.stringify(no)) c.push("official_changed");
	if (up(p.level, next.level)) c.push("level_up");
	if (down(p.level, next.level)) c.push("level_down");
	return c.join(" ");
}

export async function recordWarningLevels(
	beaches: string[] = SNAPSHOT_BEACHES,
	statusOf: (b: string) => Promise<BeachStatus> = beachStatus,
	isSim: (b: string) => Promise<boolean> = async (b) => Boolean(await getSimWeather(b).catch(() => null)) || (await listSimWarnings().catch(() => [])).length > 0,
): Promise<number> {
	const db = getDb();
	let n = 0;
	for (const beach of beaches) {
		const st = await statusOf(beach).catch(() => null);
		if (!st) continue;
		const next = rowFromStatus(st, await isSim(beach));
		const last = db.select().from(warningLevelHistory).where(eq(warningLevelHistory.beach, beach)).orderBy(desc(warningLevelHistory.id)).limit(1).get() ?? null;
		const cause = causeOf(last as Partial<Row> | null, next);
		if (last ? !cause : next.level === "NORMAL" && !next.likLevel && !(next.official ?? []).length && next.forecastLevel === "NORMAL") continue;
		db.insert(warningLevelHistory).values({ ...next, prevLevel: last?.level ?? null, cause: cause || "first" }).run();
		n += 1;
	}
	return n;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startWarningHistoryLogger(intervalMs = 60_000) {
	if (timer) return;
	timer = setInterval(() => {
		recordWarningLevels().catch((e) => console.error("[warning-history]", e instanceof Error ? e.message : e));
	}, intervalMs);
}
