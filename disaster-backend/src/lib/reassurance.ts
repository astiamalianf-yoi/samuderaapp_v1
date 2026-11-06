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

function determineBmkgRisk(weather: { windSpeed: number | null } | null, hasWarning: boolean): string {
	if (!weather) return "UNKNOWN";

	const windSpeed = weather.windSpeed ?? 0;

	if (windSpeed >= 46 || hasWarning) return "HIGH";
	if (windSpeed >= 30) return "MEDIUM";
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

function fusionDecision(
	shapRisk: string,
	bmkgRisk: string,
): { finalLevel: FinalLevel; finalLevelNumeric: number; agreed: boolean } {
	const likLevel = LIK_LEVEL_MAP[shapRisk.toUpperCase()] ?? 0;
	const bmkgLevel = BMKG_LEVEL_MAP[bmkgRisk.toUpperCase()] ?? 0;

	const score = Math.max(likLevel, bmkgLevel);

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
	const forecastWarning: string | null = await fetchBmkgWarning(beachSlug).catch(() => null);
	// BMKG short-term warnings (peringatan dini) that cover this beach also count as a warning.
	const nowcast = await getActiveNowcast(beachSlug).catch(() => []);
	const warning: string | null =
		forecastWarning ?? (nowcast.length ? `${nowcast[0]!.event} (peringatan dini BMKG)` : null);

	if (beachId && weather) {
		await saveSnapshot(beachId, { weather, warning }).catch(() => {});
	}

	const shapRisk = shapResult.riskLevel.toUpperCase();
	const bmkgRisk = determineBmkgRisk(weather, !!warning);

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
