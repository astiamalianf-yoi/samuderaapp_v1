import { initDb as getDb } from "../db";
import { bmkgSnapshots } from "../db/schema";
import { getBmkgData, type BmkgData } from "./bmkg-fetch";
import { getSimWeather } from "./bmkg-sim";

/**
 * Hourly record of the BMKG forecast per field beach (Paper 4, context of RQ4/RQ5, 26 Nov 2026):
 * how often fairly strong wind or bad weather was forecast during the field study, so that the
 * engagement of a week can be read against the weather of that week (few hazards → few warnings;
 * many warnings without hazard → false alarms). Simulated UAT weather is marked, not hidden.
 */
/** The three field beaches in Aceh; override with BMKG_SNAPSHOT_BEACHES (comma-separated). */
export const SNAPSHOT_BEACHES = (process.env.BMKG_SNAPSHOT_BEACHES ?? "pantai_lampuuk,pantai_lhoknga,pantai_ulee_lheue")
	.split(",").map((b) => b.trim()).filter(Boolean);

export type Fetcher = (beach: string) => Promise<BmkgData | null>;

export async function takeBmkgSnapshots(
	beaches: string[] = SNAPSHOT_BEACHES,
	fetch: Fetcher = getBmkgData,
	isSim: (beach: string) => Promise<boolean> = async (b) => Boolean(await getSimWeather(b).catch(() => null)),
): Promise<number> {
	let n = 0;
	for (const beach of beaches) {
		const d = await fetch(beach).catch(() => null);
		const simulated = await isSim(beach);
		getDb().insert(bmkgSnapshots).values({
			beachId: null,
			weather: JSON.stringify(d
				? { beach, available: true, windSpeed: d.windSpeed, windDirection: d.windDirection, weatherCode: d.weatherCode, weather: d.weather, isSafe: d.isSafe, periodStart: d.periodStart ?? null, periodEnd: d.periodEnd ?? null, simulated }
				: { beach, available: false, simulated }) as unknown as Record<string, unknown>,
		}).run();
		n += 1;
	}
	return n;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startBmkgSnapshotLogger(everyMinutes = Number(process.env.BMKG_SNAPSHOT_MINUTES ?? 60)) {
	if (timer || !(everyMinutes > 0)) return;
	const run = () => takeBmkgSnapshots().catch((err) => console.error("[bmkg-snapshot]", err instanceof Error ? err.message : err));
	setTimeout(run, 30_000);
	timer = setInterval(run, everyMinutes * 60_000);
}
