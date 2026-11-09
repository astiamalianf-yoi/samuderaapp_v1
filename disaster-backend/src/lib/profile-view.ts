import { desc, eq } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanClassHistory } from "../db/schema";
import type { FishermanProfile } from "./personal-warning";

/**
 * "Profil Anda" on the Profil page: the five Paper 2 tipping points (Table 8) with the fisherman's
 * own effective values, and the overall class as a colour only (never the words Actionable/Inaction).
 * On by default for now; PROFILE_CLASS_VISIBLE=false hides it (no class data is sent), so the field
 * study can still keep it hidden or use it as a condition.
 */
export const profileViewEnabled = () => process.env.PROFILE_CLASS_VISIBLE !== "false";

type Tip = { key: string; threshold: number; actionableAbove: boolean; value: (p: FishermanProfile) => number };

/** Inaction side (paper Table 8): interaction <= 1.5, avg monthly use <= 4.75, age >= 45.5,
 *  years using the signs <= 17.5, hazard types experienced >= 2.5. */
export const TIPPING_POINTS: Tip[] = [
	{ key: "disaster_interaction", threshold: 1.5, actionableAbove: true, value: (p) => p.disaster_interaction },
	{ key: "usage_frequency_avg", threshold: 4.75, actionableAbove: true, value: (p) => (p.usage_frequency_min + p.usage_frequency_max) / 2 },
	{ key: "age", threshold: 45.5, actionableAbove: false, value: (p) => p.age },
	{ key: "usage_duration", threshold: 17.5, actionableAbove: true, value: (p) => p.usage_duration },
	{ key: "disaster_experience_count", threshold: 2.5, actionableAbove: false, value: (p) => p.disaster_experience_count },
];

export type ProfileView = {
	/** colour of the box: from his latest model class; null = not known yet */
	overall: "actionable" | "inaction" | null;
	/** where the class came from: the Random Forest, or no model for his home beach (always Inaction) */
	basis: "random_forest" | "no_location_model" | null;
	features: { key: string; value: number; side: "actionable" | "inaction" }[];
};

export function profileFeatures(p: FishermanProfile): ProfileView["features"] {
	return TIPPING_POINTS.map((t) => {
		const raw = t.value(p);
		const above = raw > t.threshold; // compare before rounding for display
		return { key: t.key, value: Math.round(raw * 10) / 10, side: above === t.actionableAbove ? "actionable" : "inaction" };
	});
}

export function profileView(fishermanId: string, p: FishermanProfile | null): ProfileView | null {
	if (!profileViewEnabled() || !p) return null;
	const last = getDb()
		.select({ cls: fishermanClassHistory.behaviouralClass, source: fishermanClassHistory.source })
		.from(fishermanClassHistory)
		.where(eq(fishermanClassHistory.fishermanId, fishermanId))
		.orderBy(desc(fishermanClassHistory.id))
		.limit(1)
		.get();
	const overall = last?.cls === 1 ? "actionable" : last?.cls === 0 ? "inaction" : null;
	const basis = last?.source === "no_location_model" ? "no_location_model" : last?.source === "random_forest" ? "random_forest" : null;
	return { overall, basis, features: profileFeatures(p) };
}

/**
 * True when his latest class row was computed from a different effective profile than the one he
 * has now (profile just saved, a report just counted, or a new year), so the class must be redone.
 */
export function classIsStale(fishermanId: string, p: FishermanProfile | null): boolean {
	if (!p) return false;
	const last = getDb()
		.select({ ep: fishermanClassHistory.effectiveProfile, source: fishermanClassHistory.source })
		.from(fishermanClassHistory)
		.where(eq(fishermanClassHistory.fishermanId, fishermanId))
		.orderBy(desc(fishermanClassHistory.id))
		.limit(1)
		.get();
	return !last || JSON.stringify(last.ep) !== JSON.stringify(p);
}
