/**
 * Adaptive Trust Index of the strong-wind signs (Paper 2, Section III.B, Eq. 2-3).
 *
 *   TI_i = w_acc · Norm(Acc_i) + w_util · Norm(Util_i),  w_acc = 0.75, w_util = 0.25
 *
 * - A *record* is one fisherman practising one sign. Acc_i is the average, over the records of
 *   sign i, of the share of his predictions with the sign that were followed by strong wind;
 *   Util_i is the number of records of sign i. Both are min-max normalised over the 17 signs.
 * - Only signs with at least 20 records are ranked; the High-trust tier is everything above the
 *   largest gap between adjacent scores in the upper half of the ranking (Eq. 3).
 *
 * The survey (607 records, 245 fishermen in Aceh) is the starting point. The app adds records:
 * one per registered fisherman × sign × month (the survey asked about "the last month").
 * - His predictions: his reports of the sign (repeats within 5 minutes are one report).
 * - Followed by strong wind: a *different* fisherman reported a strong-wind or storm incident
 *   ("Lapor kejadian") at the same beach within the confirmation window after the report.
 *   A report is only judged once its window has passed.
 * With no app data the index is exactly Table 2 of Paper 2.
 */
import { and, gte, inArray } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports, incidents } from "../db/schema";

export const W_ACC = 0.75;
export const MIN_RECORDS = 20;
/** The survey was collected in Aceh, so only reports from Aceh beaches re-estimate this index. */
export const TRUST_INDEX_BEACHES = ["pantai_lampuuk", "pantai_lhoknga", "pantai_ulee_lheue"] as const;
/** Incidents that count as "followed by strong wind" (the effect of every Wn sign, Table 2). */
export const STRONG_WIND_INCIDENTS = ["angin_kencang", "badai"] as const;

export const TRUST_INDEX_MODE: "adaptive" | "paper" =
	process.env.TRUST_INDEX_MODE === "paper" ? "paper" : "adaptive";
export const CONFIRM_WINDOW_MS =
	Math.max(1, Number(process.env.TRUST_CONFIRM_WINDOW_HOURS ?? 24) || 24) * 60 * 60 * 1000;
const REPEAT_MS = 5 * 60 * 1000;

/** Survey per sign: sum of Perceived Accuracy (%) over its records, and the number of records. */
export const SURVEY_BASELINE: Record<string, { accuracySum: number; records: number }> = {
	"Wn-1": { accuracySum: 7159.2262, records: 88 },
	"Wn-2": { accuracySum: 7630.3571, records: 95 },
	"Wn-3": { accuracySum: 4867.2619, records: 56 },
	"Wn-4": { accuracySum: 4548.9286, records: 58 },
	"Wn-5": { accuracySum: 1430.0, records: 20 },
	"Wn-6": { accuracySum: 1622.7976, records: 22 },
	"Wn-7": { accuracySum: 5520.0, records: 67 },
	"Wn-8": { accuracySum: 6979.0476, records: 85 },
	"Wn-9": { accuracySum: 2353.0952, records: 29 },
	"Wn-10": { accuracySum: 1533.631, records: 17 },
	"Wn-11": { accuracySum: 1517.2222, records: 17 },
	"Wn-12": { accuracySum: 962.5, records: 12 },
	"Wn-13": { accuracySum: 1891.6667, records: 23 },
	"Wn-14": { accuracySum: 740.0, records: 8 },
	"Wn-15": { accuracySum: 300.0, records: 3 },
	"Wn-16": { accuracySum: 453.3333, records: 5 },
	"Wn-17": { accuracySum: 200.0, records: 2 },
};
export const ALL_SIGNS = Object.keys(SURVEY_BASELINE);
/** Paper 2 tiers (Table 2), used when the index cannot be computed. */
export const PAPER_HIGH = ["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"];
export const PAPER_LOW = ["Wn-13", "Wn-4", "Wn-9", "Wn-6", "Wn-5"];

/** One app record: fisherman × sign × month. */
export type AppRecord = { sign: string; predictions: number; confirmed: number };
export type SignReport = { fishermanId: string; beach: string; signs: string[]; at: number };
export type IncidentEvent = { fishermanId: string; beach: string; type: string; at: number };

export type SignTrust = {
	code: string;
	trustIndex: number; // 0-100, as in Table 2
	accuracy: number; // Acc_i, %
	records: number; // Util_i
	surveyRecords: number;
	appRecords: number;
	appReports: number;
	appConfirmed: number;
	ranked: boolean;
	tier: "High" | "Low" | "Unranked";
};
export type TrustIndexResult = {
	mode: "adaptive" | "paper";
	signs: SignTrust[]; // ranked signs by score, then unranked by score
	high: string[];
	low: string[];
	confirmWindowHours: number;
	computedAt: string;
};

const normCode = (s: string) => String(s).trim().replace(/^wn-/i, "Wn-");
const monthWib = (t: number) => new Date(t + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);

/** App records from sign reports and incidents (pure, for tests). */
export function buildAppRecords(reports: SignReport[], events: IncidentEvent[], now: number, windowMs = CONFIRM_WINDOW_MS): AppRecord[] {
	const strong = events.filter((e) => (STRONG_WIND_INCIDENTS as readonly string[]).includes(e.type));
	// Reports grouped per fisherman × sign × beach, so repeats within 5 minutes are one prediction.
	const groups = new Map<string, number[]>();
	for (const r of reports) {
		if (r.at + windowMs > now) continue; // not judged yet
		for (const raw of r.signs) {
			const sign = normCode(raw);
			if (!SURVEY_BASELINE[sign]) continue;
			const k = `${r.fishermanId}|${sign}|${r.beach}`;
			(groups.get(k) ?? groups.set(k, []).get(k)!).push(r.at);
		}
	}
	const records = new Map<string, AppRecord>();
	for (const [k, times] of groups) {
		const [fishermanId, sign, beach] = k.split("|") as [string, string, string];
		let last = -Infinity;
		for (const t of times.sort((a, b) => a - b)) {
			if (t - last < REPEAT_MS) continue;
			last = t;
			const confirmed = strong.some((e) => e.beach === beach && e.fishermanId !== fishermanId && e.at > t && e.at <= t + windowMs);
			const rk = `${fishermanId}|${sign}|${monthWib(t)}`;
			const rec = records.get(rk) ?? { sign, predictions: 0, confirmed: 0 };
			rec.predictions += 1;
			if (confirmed) rec.confirmed += 1;
			records.set(rk, rec);
		}
	}
	return [...records.values()];
}

/** Eq. 2 and Eq. 3 over the survey records plus the app records (pure, for tests). */
export function computeTrustIndex(appRecords: AppRecord[], mode: "adaptive" | "paper" = "adaptive", windowMs = CONFIRM_WINDOW_MS): TrustIndexResult {
	const app = mode === "adaptive" ? appRecords : [];
	const rows = ALL_SIGNS.map((code) => {
		const base = SURVEY_BASELINE[code]!;
		const mine = app.filter((r) => r.sign === code);
		const accSum = base.accuracySum + mine.reduce((s, r) => s + (100 * r.confirmed) / r.predictions, 0);
		const records = base.records + mine.length;
		return {
			code,
			accuracy: records ? accSum / records : 0,
			records,
			surveyRecords: base.records,
			appRecords: mine.length,
			appReports: mine.reduce((s, r) => s + r.predictions, 0),
			appConfirmed: mine.reduce((s, r) => s + r.confirmed, 0),
		};
	});
	const norm = (vals: number[]) => {
		const min = Math.min(...vals);
		const span = Math.max(...vals) - min;
		return vals.map((v) => (span > 0 ? (v - min) / span : 0));
	};
	const nAcc = norm(rows.map((r) => r.accuracy));
	const nUtil = norm(rows.map((r) => r.records));
	const scored = rows.map((r, i) => ({ ...r, trustIndex: 100 * (W_ACC * nAcc[i]! + (1 - W_ACC) * nUtil[i]!), ranked: r.records >= MIN_RECORDS }));

	const ranked = scored.filter((r) => r.ranked).sort((a, b) => b.trustIndex - a.trustIndex);
	// Eq. 3: largest gap between adjacent scores within the upper half of the ranking.
	let k = ranked.length > 0 ? 1 : 0;
	let best = -Infinity;
	for (let i = 1; i <= Math.floor(ranked.length / 2) && i < ranked.length; i++) {
		const gap = ranked[i - 1]!.trustIndex - ranked[i]!.trustIndex;
		if (gap > best) {
			best = gap;
			k = i;
		}
	}
	const high = ranked.slice(0, k).map((r) => r.code);
	const low = ranked.slice(k).map((r) => r.code);
	const unranked = scored.filter((r) => !r.ranked).sort((a, b) => b.trustIndex - a.trustIndex);
	const signs: SignTrust[] = [...ranked, ...unranked].map((r) => ({
		...r,
		trustIndex: Math.round(r.trustIndex * 100) / 100,
		accuracy: Math.round(r.accuracy * 100) / 100,
		tier: !r.ranked ? "Unranked" : high.includes(r.code) ? "High" : "Low",
	}));
	return { mode, signs, high, low, confirmWindowHours: windowMs / 3_600_000, computedAt: new Date().toISOString() };
}

const parseTime = (s: string) => Date.parse(`${s.replace(" ", "T")}Z`);

/** Reads the reports and incidents of the Aceh beaches from the database. */
export function loadAppRecords(now = Date.now()): AppRecord[] {
	const db = getDb();
	const beaches = [...TRUST_INDEX_BEACHES] as string[];
	const since = new Date(now - 3 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
	const reports: SignReport[] = db
		.select()
		.from(fishermanReports)
		.where(and(inArray(fishermanReports.beach, beaches), gte(fishermanReports.createdAt, since)))
		.all()
		.map((r) => ({ fishermanId: r.fishermanId, beach: r.beach, signs: r.signs ?? [], at: parseTime(r.createdAt) }))
		.filter((r) => Number.isFinite(r.at));
	const events: IncidentEvent[] = db
		.select()
		.from(incidents)
		.where(and(inArray(incidents.beach, beaches), inArray(incidents.type, [...STRONG_WIND_INCIDENTS] as string[])))
		.all()
		.map((i) => ({ fishermanId: i.fishermanId, beach: i.beach, type: i.type, at: parseTime(i.createdAt) }))
		.filter((e) => Number.isFinite(e.at));
	return buildAppRecords(reports, events, now);
}

let cache: { at: number; value: TrustIndexResult } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/** Current index (recomputed at most every 10 minutes); falls back to Paper 2 if the DB fails. */
export function currentTrustIndex(): TrustIndexResult {
	const now = Date.now();
	if (cache && now - cache.at < CACHE_MS) return cache.value;
	let records: AppRecord[] = [];
	if (TRUST_INDEX_MODE === "adaptive") {
		try {
			records = loadAppRecords(now);
		} catch (err) {
			console.warn("[trust-index] app records unavailable, using the survey only:", err);
		}
	}
	const value = computeTrustIndex(records, TRUST_INDEX_MODE);
	cache = { at: now, value };
	return value;
}

export function resetTrustIndexCache() {
	cache = null;
}

/** Tiers to send with /predict: the live index for the Aceh beaches, Paper 2 tiers elsewhere. */
export function trustTiersFor(beach: string): { high: string[]; low: string[] } | undefined {
	if (!(TRUST_INDEX_BEACHES as readonly string[]).includes(beach)) return undefined;
	const { high, low } = currentTrustIndex();
	return { high, low };
}
