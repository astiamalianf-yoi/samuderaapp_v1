import { ACTIVE_WARNING_TTL_SECONDS } from "../config";
import { getActiveNowcast } from "./bmkg-nowcast";
import { forecastEndFor } from "./bmkg-fetch";

/**
 * Duration of a fishermen's (LIK) warning when it is (re)triggered (decided 14 Nov 2026):
 * 1 hour for every sign; when an official BMKG warning covers the beach and ends later, the LIK
 * warning lasts until BMKG's end, as the fishermen's confirmation of it. runNowcastCheck also
 * extends an active LIK warning when BMKG starts or extends a warning afterwards.
 * Since 24 Nov 2026 the same holds for a BMKG forecast of fairly strong wind or bad weather (WASPADA
 * or SIAGA by forecast): the LIK warning lasts until the end of that forecast window (matrix rows
 * 6/9/11/14 and 16–19), whichever came first.
 */
export async function likWarningTtlSeconds(beach: string, now = Date.now()): Promise<number> {
	const bmkg = await getActiveNowcast(beach, now).catch(() => []);
	const fcEnd = await forecastEndFor(beach, now).catch(() => 0);
	const bmkgEnd = Math.max(0, fcEnd, ...bmkg.map((w) => w.expires ?? 0));
	return Math.max(ACTIVE_WARNING_TTL_SECONDS, Math.ceil((bmkgEnd - now) / 1000));
}
