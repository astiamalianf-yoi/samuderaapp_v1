import { ACTIVE_WARNING_TTL_SECONDS } from "../config";
import { getActiveNowcast } from "./bmkg-nowcast";

/**
 * Duration of a fishermen's (LIK) warning when it is (re)triggered (decided 14 Nov 2026):
 * 1 hour for every sign; when an official BMKG warning covers the beach and ends later, the LIK
 * warning lasts until BMKG's end, as the fishermen's confirmation of it. runNowcastCheck also
 * extends an active LIK warning when BMKG starts or extends a warning afterwards.
 */
export async function likWarningTtlSeconds(beach: string, now = Date.now()): Promise<number> {
	const bmkg = await getActiveNowcast(beach, now).catch(() => []);
	const bmkgEnd = Math.max(0, ...bmkg.map((w) => w.expires ?? 0));
	return Math.max(ACTIVE_WARNING_TTL_SECONDS, Math.ceil((bmkgEnd - now) / 1000));
}
