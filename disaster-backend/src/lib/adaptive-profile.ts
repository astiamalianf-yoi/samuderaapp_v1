import { and, eq, gte } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports, incidents } from "../db/schema";
import type { FishermanProfile } from "./personal-warning";

/**
 * Adaptive fisherman profile (decided with the researcher, 7 Nov 2026).
 *
 * The fisherman's registration answers are the baseline. What he does in SAMUDRA can only RAISE a
 * value, never take it below what he said:
 *  - age, fishing experience and years using natural signs are computed from the YEARS he gave,
 *    for the current year, so they grow by themselves every January;
 *  - frequency of usage per month (codebook No. 23-25): reports in the last 30 days (spaced
 *    >= 5 min) raise the max; the lowest monthly count of the last three 30-day windows raises the
 *    min (so the average follows steady use, not one busy month);
 *  - different signs reported in the last 12 months raise "number of LIK combination" (No. 7);
 *  - experience with disaster (No. 12-13: hazard types experienced AND detected using natural
 *    signs, codes B.1-B.6): an incident adds its hazard type only when he says he saw a natural
 *    sign before it happened;
 *  - level of interaction with disaster (No. 14: times he personally experienced STRONG WIND that
 *    threatened his life, damaged/capsized his boat or cost him his catch): +1 per incident of
 *    strong wind or storm.
 * The result (12 Random Forest inputs) is what the model sees; the category is never shown to him.
 */

/** Codebook No. 12 hazard codes: B.1 Tsunami ... B.6 High Tide. */
export const HAZARD_KEYS = ["tsunami", "angin_kencang", "gelombang_ekstrem", "badai", "arus_kuat", "pasang_tinggi"] as const;
export type HazardKey = (typeof HAZARD_KEYS)[number];
export const HAZARD_CODE: Record<HazardKey, string> = {
	tsunami: "B.1", angin_kencang: "B.2", gelombang_ekstrem: "B.3", badai: "B.4", arus_kuat: "B.5", pasang_tinggi: "B.6",
};
/** Keys used before 7 Nov 2026 (gempa is not a codebook hazard and is dropped). */
const LEGACY_HAZARD: Record<string, HazardKey | null> = { gelombang_tinggi: "gelombang_ekstrem", banjir_rob: "pasang_tinggi", gempa: null };
const toHazard = (h: unknown): HazardKey | null =>
	HAZARD_KEYS.includes(h as HazardKey) ? (h as HazardKey) : typeof h === "string" ? (LEGACY_HAZARD[h] ?? null) : null;

/** What happened at sea ("Lapor kejadian"); each is a codebook hazard at sea. */
export const INCIDENT_TYPES = ["angin_kencang", "gelombang_ekstrem", "badai", "arus_kuat"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
/** No. 14 counts strong wind only (a storm brings strong wind; older "perahu_rusak" rows were strong-wind damage). */
const INTERACTION_TYPES = new Set(["angin_kencang", "badai", "perahu_rusak"]);

export type ProfileAnswers = {
	birth_year: number;
	fishing_start_year: number;
	lik_start_year: number;
	fishing_role: number;
	head_of_community: number;
	fishing_duration: number;
	hazards: HazardKey[];
	disaster_interaction: number;
	lik_combination_count: number;
	usage_frequency_min: number;
	usage_frequency_max: number;
};

export type Activity = {
	reports_30d: number;
	/** Lowest report count among the last three 30-day windows. */
	reports_min_3m: number;
	signs_12m: string[];
	incidents_total: number;
	/** Incidents of strong wind / storm (codebook No. 14). */
	interaction_incidents: number;
	/** Hazard types of incidents he detected with a natural sign (codebook No. 12). */
	incident_hazards: HazardKey[];
};

/** Calendar year in Indonesia (WIB). */
export function currentYear(now = new Date()): number {
	return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now));
}

const int = (v: unknown) => (typeof v === "number" || typeof v === "string") && v !== "" && Number.isInteger(Number(v)) ? Number(v) : NaN;
const inRange = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

/** Validates registration answers; null when something is missing or not plausible. */
export function parseAnswers(input: unknown, year = currentYear()): ProfileAnswers | null {
	if (!input || typeof input !== "object") return null;
	const r = input as Record<string, unknown>;
	const a = {
		birth_year: int(r.birth_year),
		fishing_start_year: int(r.fishing_start_year),
		lik_start_year: int(r.lik_start_year),
		fishing_role: int(r.fishing_role),
		head_of_community: int(r.head_of_community),
		fishing_duration: int(r.fishing_duration),
		hazards: Array.isArray(r.hazards) ? [...new Set(r.hazards.map(toHazard).filter((h): h is HazardKey => h !== null))] : [],
		disaster_interaction: int(r.disaster_interaction),
		lik_combination_count: int(r.lik_combination_count),
		usage_frequency_min: int(r.usage_frequency_min),
		usage_frequency_max: int(r.usage_frequency_max),
	};
	const ok =
		inRange(a.birth_year, 1920, year - 10) &&
		inRange(a.fishing_start_year, a.birth_year, year) &&
		inRange(a.lik_start_year, a.birth_year, year) &&
		inRange(a.fishing_role, 1, 3) &&
		inRange(a.head_of_community, 0, 1) &&
		inRange(a.fishing_duration, 1, 3) &&
		inRange(a.disaster_interaction, 0, 50) &&
		inRange(a.lik_combination_count, 1, 17) &&
		inRange(a.usage_frequency_min, 0, 60) &&
		inRange(a.usage_frequency_max, a.usage_frequency_min, 60);
	return ok ? a : null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The 12 model inputs for this year: answers raised by activity (never lowered). */
export function effectiveProfile(a: ProfileAnswers, act: Activity, year = currentYear()): FishermanProfile {
	const freqMax = clamp(Math.max(a.usage_frequency_max, act.reports_30d), 0, 60);
	const freqMin = clamp(Math.max(a.usage_frequency_min, act.reports_min_3m), 0, freqMax);
	const hazards = new Set<HazardKey>([...a.hazards, ...act.incident_hazards]);
	return {
		age: clamp(year - a.birth_year, 10, 100),
		fishing_experience: clamp(year - a.fishing_start_year, 0, 80),
		fishing_role: a.fishing_role as FishermanProfile["fishing_role"],
		head_of_community: a.head_of_community as FishermanProfile["head_of_community"],
		fishing_duration: a.fishing_duration as FishermanProfile["fishing_duration"],
		disaster_experience_count: clamp(hazards.size, 0, 6),
		disaster_interaction: clamp(a.disaster_interaction + act.interaction_incidents, 0, 50),
		lik_combination_count: clamp(Math.max(a.lik_combination_count, act.signs_12m.length), 1, 17),
		usage_duration: clamp(year - a.lik_start_year, 0, 80),
		usage_frequency_min: freqMin,
		usage_frequency_max: freqMax,
	} as FishermanProfile;
}

const DAY = 24 * 60 * 60 * 1000;
const sqliteTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

/** Reports at least `gapMs` apart: a burst of repeats is one use of the signs. */
export function spacedCount(times: number[], gapMs = 5 * 60 * 1000): number {
	let n = 0;
	let last = -Infinity;
	for (const t of [...times].sort((x, y) => x - y)) {
		if (t - last >= gapMs) {
			n += 1;
			last = t;
		}
	}
	return n;
}

/** The fisherman's activity in SAMUDRA, from the database. */
export function loadActivity(fishermanId: string, now = new Date()): Activity {
	const db = getDb();
	const since12m = sqliteTime(new Date(now.getTime() - 365 * DAY));
	const reports = db
		.select({ signs: fishermanReports.signs, createdAt: fishermanReports.createdAt })
		.from(fishermanReports)
		.where(and(eq(fishermanReports.fishermanId, fishermanId), gte(fishermanReports.createdAt, since12m)))
		.all();
	const times = reports.map((r) => Date.parse(`${r.createdAt.replace(" ", "T")}Z`)).filter(Number.isFinite);
	const windowCount = (k: number) => {
		const end = now.getTime() - k * 30 * DAY;
		return spacedCount(times.filter((t) => t > end - 30 * DAY && t <= end));
	};
	const months = [windowCount(0), windowCount(1), windowCount(2)];
	const signs = new Set<string>();
	for (const r of reports) for (const s of r.signs ?? []) signs.add(String(s).replace(/^WN-/i, "Wn-"));

	const inc = db
		.select({ type: incidents.type, detected: incidents.detectedBySign })
		.from(incidents)
		.where(eq(incidents.fishermanId, fishermanId))
		.all();
	const hazards = new Set<HazardKey>();
	for (const i of inc) {
		const h = i.detected ? toHazard(i.type) : null;
		if (h) hazards.add(h);
	}
	return {
		reports_30d: months[0]!,
		reports_min_3m: Math.min(...months),
		signs_12m: [...signs].sort(),
		incidents_total: inc.length,
		interaction_incidents: inc.filter((i) => INTERACTION_TYPES.has(i.type)).length,
		incident_hazards: [...hazards],
	};
}

/** Answers stored at registration, or null for an older registration without them. */
export function answersOf(profile: unknown): ProfileAnswers | null {
	return parseAnswers(profile);
}

export function currentEffectiveProfile(fisherman: { id: string; profile: unknown }): FishermanProfile | null {
	const answers = answersOf(fisherman.profile);
	if (!answers) return null;
	return effectiveProfile(answers, loadActivity(fisherman.id));
}

/** Logs one sign report of a registered fisherman (app or WhatsApp). */
export function logFishermanReport(fishermanId: string, beach: string, signs: string[], channel: string, counted: boolean) {
	try {
		getDb().insert(fishermanReports).values({ fishermanId, beach, signs, channel, counted }).run();
	} catch (err) {
		console.warn("[adaptive-profile] report not logged:", err);
	}
}
