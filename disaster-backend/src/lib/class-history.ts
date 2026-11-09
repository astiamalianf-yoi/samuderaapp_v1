import { desc, eq } from "drizzle-orm";
import { ML_BASE_URL } from "../config";
import { initDb as getDb } from "../db";
import { fishermanClassHistory, type fishermen } from "../db/schema";
import { answersOf, effectiveProfile, loadActivity } from "./adaptive-profile";

/** The 10 ranked signs of Paper 2 (High: Wn-3, 8, 1, 2, 7; Low: Wn-13, 4, 9, 6, 5). */
export const RANKED_SIGNS = ["Wn-1", "Wn-2", "Wn-3", "Wn-4", "Wn-5", "Wn-6", "Wn-7", "Wn-8", "Wn-9", "Wn-13"];

type Fisherman = typeof fishermen.$inferSelect;
type MlSign = { code: string; behavioral_class?: number; probability_actionable?: number | null };
type MlBody = { signs?: MlSign[]; behavioral_source?: string };

export type ClassSnapshot = {
	effectiveProfile: Record<string, number>;
	meanProbability: number | null;
	behaviouralClass: number | null;
	perSign: Record<string, number | null>;
	source: string | null;
	/** SHAP of his answers; null when the model gave none (no location model, or not available) */
	explanation: Record<string, unknown> | null;
};

/**
 * P(actionable) of the Random Forest for this fisherman over the 10 ranked signs, using his
 * effective (adaptive) profile and home beach. behaviouralClass = 1 when most signs are >= tau.
 */
export async function computeClass(f: Fisherman, fetchImpl: typeof fetch = fetch): Promise<ClassSnapshot | null> {
	const answers = answersOf(f.profile);
	if (!answers) return null;
	const activity = loadActivity(f.id);
	const profile = effectiveProfile(answers, activity);
	const res = await fetchImpl(`${ML_BASE_URL}/predict`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ beach_location: f.homeBeach, lik_codes: RANKED_SIGNS, fisherman_profile: profile }),
		signal: AbortSignal.timeout(8000),
	}).catch(() => null);
	const body = res?.ok ? ((await res.json().catch(() => null)) as MlBody | null) : null;
	const explanation = body ? await explainProfile(f, profile, fetchImpl) : null;
	const signs = body?.signs ?? [];
	const perSign: Record<string, number | null> = {};
	for (const s of signs) perSign[s.code] = s.probability_actionable ?? null;
	const probs = signs.map((s) => s.probability_actionable).filter((p): p is number => typeof p === "number");
	const classes = signs.map((s) => s.behavioral_class).filter((c): c is number => typeof c === "number");
	return {
		effectiveProfile: profile as unknown as Record<string, number>,
		meanProbability: probs.length ? Math.round((probs.reduce((x, y) => x + y, 0) / probs.length) * 1000) / 1000 : null,
		behaviouralClass: classes.length ? (classes.filter((c) => c === 1).length * 2 >= classes.length ? 1 : 0) : null,
		perSign,
		source: body ? (signs.some((s) => s.probability_actionable == null) ? "no_location_model" : "random_forest") : "model_unavailable",
		explanation,
	};
}

/** Per-fisherman SHAP from the model service; null when not given. Never throws. */
async function explainProfile(f: Fisherman, profile: unknown, fetchImpl: typeof fetch): Promise<Record<string, unknown> | null> {
	const res = await fetchImpl(`${ML_BASE_URL}/explain-profile`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ beach_location: f.homeBeach, fisherman_profile: profile }),
		signal: AbortSignal.timeout(8000),
	}).catch(() => null);
	const body = res?.ok ? ((await res.json().catch(() => null)) as { available?: boolean; base_value?: number; contributions?: Record<string, number> } | null) : null;
	return body?.available && body.contributions ? { base_value: body.base_value ?? null, contributions: body.contributions } : null;
}

/**
 * Logs a new row when the effective profile differs from the last logged one (so a burst of
 * reports that changes nothing adds nothing). Never throws: logging must not block a report.
 */
export async function recordClass(f: Fisherman, reason: string, fetchImpl: typeof fetch = fetch): Promise<void> {
	try {
		const snap = await computeClass(f, fetchImpl);
		if (!snap) return;
		const db = getDb();
		const last = db
			.select()
			.from(fishermanClassHistory)
			.where(eq(fishermanClassHistory.fishermanId, f.id))
			.orderBy(desc(fishermanClassHistory.id))
			.limit(1)
			.get();
		if (
			last &&
			JSON.stringify(last.effectiveProfile) === JSON.stringify(snap.effectiveProfile) &&
			last.source === snap.source &&
			(last.explanation != null || snap.explanation == null)
		)
			return;
		db.insert(fishermanClassHistory)
			.values({
				fishermanId: f.id,
				reason,
				effectiveProfile: snap.effectiveProfile,
				activity: loadActivity(f.id) as unknown as Record<string, unknown>,
				meanProbability: snap.meanProbability,
				behaviouralClass: snap.behaviouralClass,
				perSign: snap.perSign,
				source: snap.source,
				explanation: snap.explanation,
			})
			.run();
	} catch (err) {
		console.warn("[class-history] not recorded:", err);
	}
}
