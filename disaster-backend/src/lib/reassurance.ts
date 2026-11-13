import { getDb } from "../db";
import { getActiveNowcast } from "./bmkg-nowcast";
import { schema } from "../db";
import { fetchBmkgWeather, fetchBmkgWarning, saveSnapshot, getBeachBySlug } from "./bmkg";
import type { BmkgWeatherData } from "./bmkg";

type ShapResult = {
	riskLevel: string;
	communityCharacteristics?: string;
	validatedSigns?: string[];
	actions?: string[];
	rawResponse?: Record<string, unknown>;
};

type ReassuranceResult = {
	shapRisk: string;
	bmkgRisk: string;
	agreed: boolean;
	finalLevel: "NORMAL" | "WASPADA" | "SIAGA" | "EKSTREM";
	finalLevelNumeric: number;
	details: Record<string, unknown>;
};

/**
 * BMKG side of the fusion:
 *   HIGH (-> SIAGA)    an active BMKG warning (peringatan dini) for the beach, or wind >= 46 km/h
 *   MEDIUM (-> WASPADA) wind >= 30 km/h, or a bad-weather forecast (rain/thunderstorm codes)
 *   LOW                 otherwise
 * A forecast alone never reaches SIAGA; only a real warning or strong wind does.
 * Final level: see fuseLevels (BAHAYA when both sides are at SIAGA).
 */
export function determineBmkgRisk(
	weather: { windSpeed: number | null; isSafe?: boolean | null } | null,
	hasOfficialWarning: boolean,
): string {
	if (hasOfficialWarning) return "HIGH";
	if (!weather) return "UNKNOWN";

	const windSpeed = weather.windSpeed ?? 0;

	if (windSpeed >= 46) return "HIGH";
	if (windSpeed >= 30 || weather.isSafe === false) return "MEDIUM";
	return "LOW";
}

type FinalLevel = "NORMAL" | "WASPADA" | "SIAGA" | "EKSTREM";

const LIK_LEVEL_MAP: Record<string, number> = {
	"NORMAL": 0,
	"WASPADA": 1,
	"SIAGA": 2,
	"EKSTREM": 3,
	"ACTIONABLE": 2,
	"HIGH": 2,
	"UNSAFE": 2,
	"MEDIUM": 1,
	"LOW": 0,
};

const BMKG_LEVEL_MAP: Record<string, number> = {
	"HIGH": 2,
	"MEDIUM": 1,
	"LOW": 0,
	"UNKNOWN": 0,
};

const LEVEL_MAP: Record<number, FinalLevel> = {
	0: "NORMAL",
	1: "WASPADA",
	2: "SIAGA",
	3: "EKSTREM",
};

/**
 * Fusion of the two sources (0 NORMAL, 1 WASPADA, 2 SIAGA, 3 EKSTREM/BAHAYA):
 * the higher of the two, and one step higher (BAHAYA) when both the fishermen's signs
 * and BMKG are at SIAGA, i.e. both sources independently point to danger.
 */
export function fuseLevels(likLevel: number, bmkgLevel: number): number {
	if (likLevel >= 2 && bmkgLevel >= 2) return 3;
	return Math.max(likLevel, bmkgLevel);
}

export function fusionDecision(
	shapRisk: string,
	bmkgRisk: string,
): { finalLevel: FinalLevel; finalLevelNumeric: number; agreed: boolean } {
	const likLevel = LIK_LEVEL_MAP[shapRisk.toUpperCase()] ?? 0;
	const bmkgLevel = BMKG_LEVEL_MAP[bmkgRisk.toUpperCase()] ?? 0;

	const score = fuseLevels(likLevel, bmkgLevel);

	const agreed = likLevel === bmkgLevel;

	return {
		finalLevel: LEVEL_MAP[score],
		finalLevelNumeric: score,
		agreed,
	};
}

export async function reassure(
	predictionId: number,
	reportId: string,
	shapResult: ShapResult,
	beachSlug: string,
): Promise<ReassuranceResult> {
	const db = getDb();

	const beach = await getBeachBySlug(beachSlug);
	const beachId = beach?.id ?? null;
	if (!beachId) {
		console.warn("[reassurance] Beach not found:", beachSlug);
	}

	const weather: BmkgWeatherData | null = await fetchBmkgWeather(beachSlug).catch(() => null);
	// Bad-weather forecast text (kept for the snapshot/explanation; it only raises to WASPADA).
	const forecastWarning: string | null = await fetchBmkgWarning(beachSlug).catch(() => null);
	// Official BMKG short-term warnings (peringatan dini) covering this beach.
	const nowcast = await getActiveNowcast(beachSlug).catch(() => []);
	const officialWarning = nowcast.length ? `${nowcast[0]!.event} (peringatan dini BMKG)` : null;
	const warning: string | null = officialWarning ?? forecastWarning;

	if (beachId && weather) {
		await saveSnapshot(beachId, { weather, warning }).catch(() => {});
	}

	const shapRisk = shapResult.riskLevel.toUpperCase();
	const bmkgRisk = determineBmkgRisk(weather, !!officialWarning);

	const { finalLevel, finalLevelNumeric, agreed } = fusionDecision(shapRisk, bmkgRisk);

	const result: ReassuranceResult = {
		shapRisk,
		bmkgRisk,
		agreed,
		finalLevel,
		finalLevelNumeric,
		details: { weather, warning, nowcast },
	};

	await db.insert(schema.reassuranceResults).values({
		predictionId,
		reportId,
		shapRisk: result.shapRisk,
		bmkgRisk: result.bmkgRisk,
		agreed: result.agreed,
		finalLevel: result.finalLevel,
		details: JSON.stringify(result.details),
	});

	return result;
}
