import { getActiveWarning } from "./crowdsource";
import { getActiveNowcast } from "./bmkg-nowcast";
import { getBmkgData } from "./bmkg-fetch";
import { fuseLevels } from "./reassurance";
import { ALLOWED_BEACH_LOCATIONS } from "../types";

/**
 * Status of every beach for the Peta page, with the same rule as the Beranda card (community
 * level, without a fisherman's personal strategy):
 * - fishermen's side: the active LIK warning (if distributed) and its level;
 * - BMKG side: an official warning covering the beach or wind >= 46 km/h -> SIAGA;
 *   wind >= 30 km/h or a bad-weather forecast -> WASPADA (frontend assessBmkg);
 * - final: fuseLevels(LIK, BMKG): BAHAYA when the fishermen are at SIAGA and BMKG has an official warning.
 */
export const LEVELS = ["NORMAL", "WASPADA", "SIAGA", "EKSTREM"] as const;
export type Level = (typeof LEVELS)[number];
const WIND_WASPADA_KMH = 30;
const WIND_SIAGA_KMH = 46;

export function toLevelIndex(v: unknown): number {
	const s = String(v ?? "").toUpperCase();
	if (s === "EKSTREM" || s === "BAHAYA") return 3;
	if (s === "SIAGA" || s === "HIGH") return 2;
	if (s === "WASPADA" || s === "MEDIUM") return 1;
	return 0;
}

export type BeachStatus = {
	beach: string;
	level: Level;
	/** reporters, endsAt and strategy (community) so the popup uses the same wording as the Beranda card. */
	lik: { level: Level; codes: string[]; triggeredAt: number; endsAt?: number | null; reporters?: number; strategy?: string | null } | null;
	bmkg: {
		level: Level;
		/** BMKG forecast level alone (wind / weather), without the official warning. */
		forecastLevel?: Level;
		/** Forecast window with bad weather (BMKG 3-hourly slots). */
		periodStart?: number | null;
		periodEnd?: number | null;
		warnings: { event: string; expires: number | null; effective?: number | null }[];
		weather: string | null;
		windSpeed: number | null;
		windDirection: string | null;
		temperature: number | null;
	};
};

export async function beachStatus(beach: string, now = Date.now()): Promise<BeachStatus> {
	const [active, nowcast, forecast] = await Promise.all([
		getActiveWarning(beach).catch(() => null),
		getActiveNowcast(beach, now).catch(() => []),
		getBmkgData(beach).catch(() => null),
	]);

	let fc = 0;
	if (forecast) {
		if (forecast.windSpeed >= WIND_SIAGA_KMH) fc = 2;
		else if (forecast.windSpeed >= WIND_WASPADA_KMH || !forecast.isSafe) fc = 1;
	}
	const bmkg = Math.max(nowcast.length ? 2 : 0, fc);

	const ev = (active?.alertEvent ?? null) as Record<string, any> | null;
	const distributed = active ? (ev?.decision?.shouldDistribute ?? true) : false;
	let level = bmkg;
	let lik: BeachStatus["lik"] = null;
	if (active && distributed) {
		// The fishermen's own level. decision.final_risk_level is not used: it was fused with the BMKG
		// situation at report time and would keep the beach raised after BMKG has ended (UAT G-11).
		const likLevel = toLevelIndex(ev?.ml?.lik_risk_level ?? ev?.riskLevel ?? ev?.decision?.final_risk_level);
		level = fuseLevels(likLevel, bmkg, nowcast.length > 0);
		lik = {
			level: LEVELS[Math.max(likLevel, 1)]!,
			codes: (ev?.ml?.active_warning as string[] | undefined) ?? active.codes,
			triggeredAt: active.triggeredAt,
			endsAt: active.expiresAt ?? null,
			reporters: Math.max(1, Number(ev?.reporterCount) || 1),
			strategy: (ev?.ml?.warning_strategy?.code as string | undefined) ?? null,
		};
	}

	return {
		beach,
		level: LEVELS[level]!,
		lik,
		bmkg: {
			level: LEVELS[bmkg]!,
			forecastLevel: LEVELS[fc]!,
			periodStart: forecast?.periodStart ?? null,
			periodEnd: forecast?.periodEnd ?? null,
			warnings: nowcast.map((w) => ({ event: w.event, expires: w.expires, effective: w.effective })),
			weather: forecast?.weather ?? null,
			windSpeed: forecast?.windSpeed ?? null,
			windDirection: forecast?.windDirection ?? null,
			temperature: forecast?.temperature ?? null,
		},
	};
}

export const allBeachStatus = (now = Date.now()) => Promise.all(ALLOWED_BEACH_LOCATIONS.map((b) => beachStatus(b, now)));
