import { createHash } from "node:crypto";
import { ML_BASE_URL } from "../config";
import { redis } from "./redis";
import type { MlResult } from "../types";

/** The 12 fisherman features of the Random Forest (supplementary codebook); avg is derived. */
export type FishermanProfile = {
	age: number;
	fishing_experience: number;
	fishing_role: number;
	head_of_community: number;
	fishing_duration: number;
	disaster_experience_count: number;
	disaster_interaction: number;
	lik_combination_count: number;
	usage_duration: number;
	usage_frequency_min: number;
	usage_frequency_max: number;
};

const LIMITS: Record<keyof FishermanProfile, [number, number]> = {
	age: [10, 100],
	fishing_experience: [0, 80],
	fishing_role: [1, 3],
	head_of_community: [0, 1],
	fishing_duration: [1, 3],
	disaster_experience_count: [0, 6],
	disaster_interaction: [0, 50],
	lik_combination_count: [1, 17],
	usage_duration: [0, 80],
	usage_frequency_min: [0, 60],
	usage_frequency_max: [0, 60],
};

/** Returns a clean profile, or null when any field is missing or out of range. */
export function parseFishermanProfile(input: unknown): FishermanProfile | null {
	if (!input || typeof input !== "object") return null;
	const raw = input as Record<string, unknown>;
	const out = {} as FishermanProfile;
	for (const [key, [min, max]] of Object.entries(LIMITS) as [keyof FishermanProfile, [number, number]][]) {
		const v = Number(raw[key]);
		if (!Number.isFinite(v) || v < min || v > max) return null;
		out[key] = v;
	}
	if (out.usage_frequency_min > out.usage_frequency_max) return null;
	return out;
}

export type PersonalWarning = {
	lik_risk_level: MlResult["lik_risk_level"];
	warning_strategy: MlResult["warning_strategy"];
	action_recommendation: string;
};

const CACHE_TTL_SECONDS = 600;

/**
 * Runs the model service for one fisherman: trust tier of the active signs x the
 * Random Forest prediction for this profile -> warning strategy (paper Eq. 4-5).
 * Results are cached per (alert, profile) for 10 minutes.
 */
export async function computePersonalWarning(
	beachLocation: string,
	codes: string[],
	profile: FishermanProfile,
	alertId: string,
): Promise<PersonalWarning | null> {
	const hash = createHash("sha256").update(JSON.stringify(profile)).digest("hex").slice(0, 16);
	const cacheKey = `warning:personal:${alertId}:${hash}`;
	try {
		const cached = await redis.get(cacheKey);
		if (cached) return JSON.parse(cached) as PersonalWarning;
	} catch {
		// cache is best-effort
	}

	const res = await fetch(`${ML_BASE_URL}/predict`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ beach_location: beachLocation, lik_codes: codes, fisherman_profile: profile }),
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok) return null;
	const ml = (await res.json()) as MlResult;
	const out: PersonalWarning = {
		lik_risk_level: ml.lik_risk_level,
		warning_strategy: ml.warning_strategy ?? null,
		action_recommendation: ml.action_recommendation,
	};
	try {
		await redis.set(cacheKey, JSON.stringify(out), { EX: CACHE_TTL_SECONDS });
	} catch {
		// ignore
	}
	return out;
}
