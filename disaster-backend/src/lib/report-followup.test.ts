import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import * as schema from "../db/schema";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(import.meta.dir, "..", "db", "migrations") });
mock.module("../db", () => ({ initDb: () => db, getDb: () => db, schema }));

// @ts-expect-error -- the query string only makes Bun load the real file
const R = (await import("./report-followup.ts?real-followup")) as typeof import("./report-followup");
// @ts-expect-error -- the query string only makes Bun load the real file
const S = (await import("./incident-store.ts?real-incident-store")) as typeof import("./incident-store");

const t = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const H = 3600_000;
let n = 0;
function fisherman(): string {
	const id = `f-followup-${++n}`;
	db.insert(schema.fishermen).values({ id, phoneHash: `h${id}`, phoneLast4: "0001", homeBeach: "pantai_lampuuk", tokenHash: `t${id}`, consentAt: t(new Date()) } as any).run();
	return id;
}
function report(fishermanId: string, at: Date, beach = "pantai_lampuuk", channel = "APP") {
	return db.insert(schema.fishermanReports).values({ fishermanId, beach, signs: ["WN-3"], channel, counted: true, createdAt: t(at) }).returning().get();
}

describe("follow-up after his own sign report", () => {
	test("nothing to ask without a report in the last 24 h", () => {
		const f = fisherman();
		report(f, new Date(Date.now() - 25 * H));
		expect(R.pendingFollowup(f)).toBeNull();
	});

	test("both questions open for 24 h, from an app or a WhatsApp report", () => {
		const f = fisherman();
		const at = new Date(Date.now() - 2 * H);
		const r = report(f, at, "pantai_lampuuk", "WHATSAPP");
		const p = R.pendingFollowup(f)!;
		expect(p.reportId).toBe(r.id);
		expect(p.needResponse && p.needHazard).toBe(true);
		expect(p.channel).toBe("WHATSAPP");
		expect(Date.parse(p.until) - Date.parse(p.reportedAt)).toBe(24 * H);
	});

	test("each question disappears on its own once answered", () => {
		const f = fisherman();
		report(f, new Date(Date.now() - H));
		const a = R.answerFollowup({ fishermanId: f, kind: "response", value: "secure_gear", channel: "APP" });
		expect(a.ok && a.pending?.needResponse).toBe(false);
		expect(a.ok && a.pending?.needHazard).toBe(true);
		expect(R.answerFollowup({ fishermanId: f, kind: "response", value: "none", channel: "APP" })).toEqual({ ok: false, error: "already_answered" });
		const b = R.answerFollowup({ fishermanId: f, kind: "hazard", value: "not_came", channel: "WHATSAPP" });
		expect(b).toEqual({ ok: true, pending: null });
	});

	test("an incident at the same beach answers 'did danger come' and is linked", () => {
		const f = fisherman();
		const r = report(f, new Date(Date.now() - H));
		const inc = S.saveIncident({ fishermanId: f, beach: "pantai_lampuuk", type: "angin_kencang", channel: "WHATSAPP" });
		const p = R.pendingFollowup(f)!;
		expect(p.needHazard).toBe(false);
		expect(p.needResponse).toBe(true);
		const row = sqlite.query("SELECT kind, value, incident_id, channel FROM report_followups WHERE report_id = ?").get(r.id) as any;
		expect(row).toEqual({ kind: "hazard", value: "came", incident_id: inc.id, channel: "WHATSAPP" });
	});

	test("an incident at another beach does not answer it", () => {
		const f = fisherman();
		report(f, new Date(Date.now() - H));
		S.saveIncident({ fishermanId: f, beach: "pantai_lhoknga", type: "angin_kencang" });
		expect(R.pendingFollowup(f)!.needHazard).toBe(true);
	});

	test("invalid values and a stale report id are refused", () => {
		const f = fisherman();
		const r = report(f, new Date(Date.now() - H));
		expect(R.answerFollowup({ fishermanId: f, kind: "response", value: "fly", channel: "APP" })).toEqual({ ok: false, error: "invalid_value" });
		expect(R.answerFollowup({ fishermanId: f, kind: "hazard", value: "not_came", channel: "APP", reportId: r.id + 999 })).toEqual({ ok: false, error: "stale_report" });
	});
});

describe("cross-check: the others of the beach are asked", () => {
	test("another fisherman's report (app or WhatsApp) opens one neutral question per beach", () => {
		const a = fisherman(), b = fisherman(), me = fisherman();
		const r1 = report(a, new Date(Date.now() - 3 * H), "pantai_lhoknga", "WHATSAPP");
		const r2 = report(b, new Date(Date.now() - H), "pantai_lhoknga");
		const c = R.crossCheckFor(me, "pantai_lhoknga")!;
		expect(c.reporters).toBe(2);
		expect(c.reportId).toBe(r2.id);
		expect(c.since).toBe(R.pendingFollowup(a)!.reportedAt);
		expect(Date.parse(c.until) - Date.parse(R.pendingFollowup(b)!.reportedAt)).toBe(24 * H);
		expect(R.crossCheckFor(me, "pantai_ulee_lheue")).toBeNull();
		expect(r1.id).toBeLessThan(r2.id);
	});

	test("the reporter himself gets his own questions, not the cross-check", () => {
		const a = fisherman(), b = fisherman();
		report(a, new Date(Date.now() - 2 * H), "pantai_lhoknga");
		report(b, new Date(Date.now() - H), "pantai_lhoknga");
		expect(R.crossCheckFor(b, "pantai_lhoknga")).toBeNull();
		expect(R.pendingFollowup(b)!.needHazard).toBe(true);
	});

	test("'Tidak ada' or an incident there closes it; a new report later opens it again", () => {
		const a = fisherman(), me = fisherman(), other = fisherman();
		report(a, new Date(Date.now() - 2 * H), "pantai_ulee_lheue");
		expect(R.answerCrossCheck({ fishermanId: me, beach: "pantai_ulee_lheue", channel: "APP" })).toEqual({ ok: true });
		expect(R.crossCheckFor(me, "pantai_ulee_lheue")).toBeNull();
		expect(R.answerCrossCheck({ fishermanId: me, beach: "pantai_ulee_lheue", channel: "APP" })).toEqual({ ok: false, error: "no_question" });
		const inc = S.saveIncident({ fishermanId: other, beach: "pantai_ulee_lheue", type: "angin_kencang" });
		expect(R.crossCheckFor(other, "pantai_ulee_lheue")).toBeNull();
		const row = sqlite.query("SELECT value, incident_id FROM report_followups WHERE fisherman_id = ? AND kind = 'crosscheck'").get(other) as any;
		expect(row).toEqual({ value: "came", incident_id: inc.id });
	});

	test("gone 24 h after the last report", () => {
		const a = fisherman(), me = fisherman();
		report(a, new Date(Date.now() - 25 * H), "pantai_sepi");
		expect(R.crossCheckFor(me, "pantai_sepi", new Date())).toBeNull();
		report(a, new Date(Date.now() - 23 * H), "pantai_sepi");
		expect(R.crossCheckFor(me, "pantai_sepi", new Date())).not.toBeNull();
	});
});

describe("WhatsApp words", () => {
	test("!tindakan by number or by words", () => {
		expect(R.parseTindakan("!tindakan 3")).toBe("secure_gear");
		expect(R.parseTindakan("!tindakan 4")).toBe("adjust_time");
		expect(R.parseTindakan("!tindakan tunda melaut")).toBe("adjust_time");
		expect(R.parseTindakan("!tindakan tidak ada")).toBe("none");
		expect(R.parseTindakan("!tindakan 9")).toBeNull();
	});
	test("!angin ya / tidak", () => {
		expect(R.parseAngin("!angin ya")).toBe("came");
		expect(R.parseAngin("!angin iya datang")).toBe("came");
		expect(R.parseAngin("!angin tidak")).toBe("not_came");
		expect(R.parseAngin("!angin gak")).toBe("not_came");
		expect(R.parseAngin("!angin")).toBeNull();
	});
	test("the prompt lists only the open questions", () => {
		const both = R.whatsappFollowupPrompt({ needResponse: true, needHazard: true }).join("\n");
		expect(both).toContain("!tindakan");
		expect(both).toContain("3. Amankan alat tangkap");
		expect(both).toContain("!angin ya");
		expect(R.whatsappFollowupPrompt({ needResponse: false, needHazard: true }).join("\n")).not.toContain("!tindakan");
	});
});
