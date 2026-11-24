import { and, desc, eq, gte, lte } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports, incidents, reportFollowups } from "../db/schema";

/**
 * After his own sign report (app or WhatsApp) a fisherman is asked, for 24 hours, two separate
 * questions he may answer independently:
 *  - response: what he did when he saw the sign (codebook No. 29 options);
 *  - hazard: did strong wind (or another danger) come? "Ya" is an incident report, "Tidak" is saved.
 * A question disappears as soon as it is answered, and both disappear 24 h after the report.
 * The answers are kept for research only; the Trust Index accuracy is unchanged (it still needs a
 * different fisherman's incident).
 */
export const FOLLOWUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Codebook No. 29 (questionnaire options), in the order of the question. */
export const RESPONSES: Record<string, string> = {
	none: "Tidak melakukan apa-apa",
	careful: "Berhati-hati (amati tanda lain)",
	secure_gear: "Amankan alat tangkap",
	adjust_time: "Sesuaikan jadwal melaut",
	repair_boat: "Perbaiki perahu",
};
export const RESPONSE_KEYS = Object.keys(RESPONSES);
export const HAZARD_VALUES = ["came", "not_came"] as const;

const sqliteTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const isoOf = (t: string) => new Date(`${t.replace(" ", "T")}Z`).toISOString();

export type PendingFollowup = {
	reportId: number;
	beach: string;
	signs: string[];
	channel: string;
	reportedAt: string;
	until: string;
	needResponse: boolean;
	needHazard: boolean;
};

/** His latest sign report of the last 24 h and which of the two questions are still open; null if none. */
export function pendingFollowup(fishermanId: string, now = new Date()): PendingFollowup | null {
	const db = getDb();
	const report = db
		.select()
		.from(fishermanReports)
		.where(and(
			eq(fishermanReports.fishermanId, fishermanId),
			gte(fishermanReports.createdAt, sqliteTime(new Date(now.getTime() - FOLLOWUP_WINDOW_MS))),
		))
		.orderBy(desc(fishermanReports.createdAt), desc(fishermanReports.id))
		.get();
	if (!report) return null;
	const answered = new Set(
		db.select({ kind: reportFollowups.kind }).from(reportFollowups).where(eq(reportFollowups.reportId, report.id)).all().map((r) => r.kind),
	);
	// An incident he reported at that beach after the sign also answers "did danger come?".
	const incidentAfter = db
		.select({ id: incidents.id })
		.from(incidents)
		.where(and(eq(incidents.fishermanId, fishermanId), eq(incidents.beach, report.beach), gte(incidents.createdAt, report.createdAt)))
		.get();
	const needResponse = !answered.has("response");
	const needHazard = !answered.has("hazard") && !incidentAfter;
	if (!needResponse && !needHazard) return null;
	const reportedAt = isoOf(report.createdAt);
	return {
		reportId: report.id,
		beach: report.beach,
		signs: report.signs,
		channel: report.channel,
		reportedAt,
		until: new Date(new Date(reportedAt).getTime() + FOLLOWUP_WINDOW_MS).toISOString(),
		needResponse,
		needHazard,
	};
}

export type AnswerResult =
	| { ok: true; pending: PendingFollowup | null }
	| { ok: false; error: "no_report" | "already_answered" | "invalid_value" | "stale_report" };

/** Saves one answer to the open question of his latest report. */
export function answerFollowup(o: {
	fishermanId: string; kind: "response" | "hazard"; value: string; channel: string;
	reportId?: number; incidentId?: string | null; now?: Date;
}): AnswerResult {
	const now = o.now ?? new Date();
	const valid = o.kind === "response" ? RESPONSE_KEYS.includes(o.value) : (HAZARD_VALUES as readonly string[]).includes(o.value);
	if (!valid) return { ok: false, error: "invalid_value" };
	const p = pendingFollowup(o.fishermanId, now);
	if (!p) return { ok: false, error: "no_report" };
	if (o.reportId !== undefined && o.reportId !== p.reportId) return { ok: false, error: "stale_report" };
	if (o.kind === "response" ? !p.needResponse : !p.needHazard) return { ok: false, error: "already_answered" };
	getDb()
		.insert(reportFollowups)
		.values({ reportId: p.reportId, fishermanId: o.fishermanId, kind: o.kind, value: o.value, incidentId: o.incidentId ?? null, channel: o.channel })
		.onConflictDoNothing()
		.run();
	return { ok: true, pending: pendingFollowup(o.fishermanId, now) };
}

/** An incident at the beach of his latest report (last 24 h) answers its hazard question: "came". */
export function linkIncidentToFollowup(fishermanId: string, beach: string, incidentId: string, channel: string, at = new Date()) {
	try {
		const db = getDb();
		const report = db
			.select({ id: fishermanReports.id, beach: fishermanReports.beach })
			.from(fishermanReports)
			.where(and(
				eq(fishermanReports.fishermanId, fishermanId),
				gte(fishermanReports.createdAt, sqliteTime(new Date(at.getTime() - FOLLOWUP_WINDOW_MS))),
				lte(fishermanReports.createdAt, sqliteTime(at)),
			))
			.orderBy(desc(fishermanReports.createdAt), desc(fishermanReports.id))
			.get();
		if (!report || report.beach !== beach) return;
		db.insert(reportFollowups)
			.values({ reportId: report.id, fishermanId, kind: "hazard", value: "came", incidentId, channel })
			.onConflictDoNothing()
			.run();
	} catch (err) {
		console.warn("[report-followup] incident not linked:", err);
	}
}

/** Text for WhatsApp: the two questions after a report, answered with !tindakan and !angin. */
export function whatsappFollowupPrompt(p: Pick<PendingFollowup, "needResponse" | "needHazard">): string[] {
	const lines: string[] = [];
	if (!p.needResponse && !p.needHazard) return lines;
	lines.push("", "📝 Dalam 24 jam, kabari kami (boleh salah satu):");
	if (p.needResponse) {
		lines.push(
			"• Apa yang Anda lakukan? Balas *!tindakan* dan nomornya:",
			...RESPONSE_KEYS.map((k, i) => `   ${i + 1}. ${RESPONSES[k]}`),
		);
	}
	if (p.needHazard) lines.push("• Angin kencang datang? Balas *!angin ya* atau *!angin tidak*");
	return lines;
}

/** "!tindakan 3" or "!tindakan amankan alat" -> response key; null if not understood. */
export function parseTindakan(text: string): string | null {
	const t = text.toLowerCase().replace(/^!tindakan\b/, "").trim();
	const n = t.match(/^\d+/);
	if (n) return RESPONSE_KEYS[Number(n[0]) - 1] ?? null;
	if (/tidak|nggak|gak|ga\b/.test(t)) return "none";
	if (/hati|amati/.test(t)) return "careful";
	if (/alat|jaring|amankan/.test(t)) return "secure_gear";
	if (/jadwal|tunda|tidak melaut|pulang|batal/.test(t)) return "adjust_time";
	if (/perbaik|perahu|kapal/.test(t)) return "repair_boat";
	return null;
}

/** "!angin ya" / "!angin tidak" -> came / not_came; null if not understood. */
export function parseAngin(text: string): "came" | "not_came" | null {
	const t = text.toLowerCase().replace(/^!angin\b/, "").trim();
	if (/^(tidak|tdk|gak|nggak|ga|engga|enggak|no)\b/.test(t)) return "not_came";
	if (/^(ya|iya|yes|y|datang|ada)\b/.test(t)) return "came";
	return null;
}
