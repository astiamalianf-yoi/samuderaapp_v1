import { sql } from "drizzle-orm";
import { initDb as getDb } from "../db";

/**
 * Behavioural class of a beach's WhatsApp group (one message for everyone), by majority rule.
 *
 * A group cannot get a personal warning, so its warning uses the beach's class. With enough
 * registered fishermen at the beach, that class comes from them: for each sign, the share of
 * registered fishermen whose adaptive profile is Inaction (P(actionable) < τ in their latest
 * class-history row). More than half Inaction → the group gets the Inaction strategy for that sign;
 * otherwise Actionable. With too few registered fishermen, the survey beach profile is kept.
 *
 * GROUP_CLASS_MODE=survey keeps the survey profile always (a fixed condition for the study).
 */
export const groupClassMode = (): "majority" | "survey" => (process.env.GROUP_CLASS_MODE === "survey" ? "survey" : "majority");
export const groupMajorityMin = (): number => Math.max(1, Number(process.env.GROUP_MAJORITY_MIN ?? 10) || 10);
export const actionableThreshold = (): number => Number(process.env.ML_ACTIONABLE_THRESHOLD ?? 0.6) || 0.6;

export type CommunityBasis = {
	source: "community_majority";
	/** class per sign: 1 = Actionable, 0 = Inaction (only signs with at least `min` fishermen) */
	classes: Record<string, 0 | 1>;
	/** share of Inaction fishermen per sign, 0–1 */
	inactionShare: Record<string, number>;
	/** registered fishermen at the beach with a profile on record */
	registered: number;
	min: number;
};

/** Pure majority rule over the latest P(actionable) per sign of each fisherman. */
export function majorityClasses(
	perSignRows: Record<string, number | null | undefined>[],
	min = groupMajorityMin(),
	tau = actionableThreshold(),
): CommunityBasis | null {
	if (perSignRows.length < min) return null;
	const tally: Record<string, { n: number; inaction: number }> = {};
	for (const row of perSignRows) {
		for (const [sign, p] of Object.entries(row ?? {})) {
			if (typeof p !== "number" || !Number.isFinite(p)) continue;
			const t = (tally[sign] ??= { n: 0, inaction: 0 });
			t.n += 1;
			if (p < tau) t.inaction += 1;
		}
	}
	const classes: Record<string, 0 | 1> = {};
	const inactionShare: Record<string, number> = {};
	for (const [sign, t] of Object.entries(tally)) {
		if (t.n < min) continue;
		const share = t.inaction / t.n;
		inactionShare[sign] = Math.round(share * 1000) / 1000;
		classes[sign] = share > 0.5 ? 0 : 1;
	}
	if (Object.keys(classes).length === 0) return null;
	return { source: "community_majority", classes, inactionShare, registered: perSignRows.length, min };
}

/** Majority classes for one beach from the database, or null (survey profile is used). */
export function communityBasisFor(beach: string): CommunityBasis | null {
	if (groupClassMode() === "survey") return null;
	try {
		const rows = getDb().all<{ per_sign: string | null }>(sql`
			select h.per_sign as per_sign
			from fishermen f
			join fisherman_class_history h on h.fisherman_id = f.id
			where f.home_beach = ${beach}
			  and h.id = (select max(id) from fisherman_class_history where fisherman_id = f.id)`);
		const perSign = rows
			.map((r) => {
				try {
					return r.per_sign ? (JSON.parse(r.per_sign) as Record<string, number | null>) : null;
				} catch {
					return null;
				}
			})
			.filter((r): r is Record<string, number | null> => r !== null);
		return majorityClasses(perSign);
	} catch (err) {
		console.warn("[community-class] falling back to the survey beach profile:", err);
		return null;
	}
}
