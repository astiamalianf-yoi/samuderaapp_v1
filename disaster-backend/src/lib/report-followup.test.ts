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
