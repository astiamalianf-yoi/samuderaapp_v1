import { desc, eq } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanClassHistory } from "../db/schema";
import type { FishermanProfile } from "./personal-warning";

/**
 * "Profil Anda" on the Profil page. The box shows the overall model class as a colour (never the
 * words Actionable/Inaction), the three answers that most moved HIS result (per-fisherman SHAP of
 * the Random Forest, the same method as Paper 2) and all his answers. On by default for now;
 * PROFILE_CLASS_VISIBLE=false hides it (no class data is sent).
 */
export const profileViewEnabled = () => process.env.PROFILE_CLASS_VISIBLE !== "false";

/** Answer keys as the fisherman sees them (the three usage-frequency features are one answer). */
export const ANSWER_KEYS = [
	"usage_frequency",
	"lik_combination_count",
	"usage_duration",
	"disaster_interaction",
	"disaster_experience_count",
	"age",
	"fishing_experience",
	"fishing_role",
	"fishing_duration",
	"head_of_community",
] as const;
export type AnswerKey = (typeof ANSWER_KEYS)[number];

/** SHAP of his answers as stored with a class row (from the model service /explain-profile). */
export type Explanation = { base_value: number; contributions: Partial<Record<AnswerKey, number>> };

export type ProfileView = {
	/** colour of the box: from his latest model class; null = not known yet */
	overall: "actionable" | "inaction" | null;
	/** where the class came from: the Random Forest, or no model for his home beach (always Inaction) */
	basis: "random_forest" | "no_location_model" | null;
	/** up to three answers that moved his result most; up = towards Actionable ("mendukung") */
	top: { key: AnswerKey; push: "up" | "down" }[];
	/** all his answers (effective values: registration answers raised by his activity) */
	answers: { key: AnswerKey; value: number; min?: number; max?: number }[];
};

/** Contributions smaller than this barely move him and are not shown as a reason. */
const MIN_SHOWN = 0.005;

export function topReasons(e: Explanation | null | undefined, n = 3): ProfileView["top"] {
	if (!e?.contributions) return [];
	return Object.entries(e.contributions)
		.filter((x): x is [AnswerKey, number] => typeof x[1] === "number" && Math.abs(x[1]) >= MIN_SHOWN)
		.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
		.slice(0, n)
		.map(([key, v]) => ({ key, push: v > 0 ? "up" : "down" }));
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function profileAnswers(p: FishermanProfile): ProfileView["answers"] {
	return ANSWER_KEYS.map((key) =>
		key === "usage_frequency"
			? { key, value: r1((p.usage_frequency_min + p.usage_frequency_max) / 2), min: p.usage_frequency_min, max: p.usage_frequency_max }
			: { key, value: r1(p[key]) },
	);
}

function lastRow(fishermanId: string) {
	return getDb()
		.select({
			cls: fishermanClassHistory.behaviouralClass,
			source: fishermanClassHistory.source,
			ep: fishermanClassHistory.effectiveProfile,
			explanation: fishermanClassHistory.explanation,
		})
		.from(fishermanClassHistory)
		.where(eq(fishermanClassHistory.fishermanId, fishermanId))
		.orderBy(desc(fishermanClassHistory.id))
		.limit(1)
		.get();
}

export function profileView(fishermanId: string, p: FishermanProfile | null): ProfileView | null {
	if (!profileViewEnabled() || !p) return null;
	const last = lastRow(fishermanId);
	const overall = last?.cls === 1 ? "actionable" : last?.cls === 0 ? "inaction" : null;
	const basis = last?.source === "no_location_model" ? "no_location_model" : last?.source === "random_forest" ? "random_forest" : null;
	return {
		overall,
		basis,
		top: basis === "random_forest" ? topReasons(last?.explanation as Explanation | null) : [],
		answers: profileAnswers(p),
	};
}

/**
 * True when his latest class row is behind: computed from a different effective profile than the
 * one he has now (profile just saved, a report just counted, a new year), or from before the
 * explanation was kept.
 */
export function classIsStale(fishermanId: string, p: FishermanProfile | null): boolean {
	if (!p) return false;
	const last = lastRow(fishermanId);
	if (!last || JSON.stringify(last.ep) !== JSON.stringify(p)) return true;
	return last.source === "random_forest" && !last.explanation;
}
