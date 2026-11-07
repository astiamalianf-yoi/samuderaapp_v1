/**
 * One fisherman, two channels: his app reports, his WhatsApp reports (also those sent before he
 * registered) and his WhatsApp incidents all end in one history, which the adaptive profile and
 * the Trust Index read.
 */
import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Hono } from "hono";
import path from "path";
import * as schema from "../db/schema";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(import.meta.dir, "..", "db", "migrations") });

mock.module("../db", () => ({ initDb: () => db, getDb: () => db, schema }));
mock.module("../lib/redis", () => ({ redis: { xAdd: async () => "1", set: async () => "OK", publish: async () => 0 } }));
mock.module("../lib/class-history", () => ({ recordClass: async () => {} }));
const replies: string[] = [];
mock.module("../lib/openclaw", () => ({ sendOpenClawReply: async (_to: string, t: string) => { replies.push(t); }, sendOpenClawAlert: async () => {} }));
// @ts-expect-error -- the query string only makes Bun load the real file
const realCrowd = (await import("../lib/crowdsource.ts?real-for-wa-sync")) as typeof import("../lib/crowdsource");
const seen: (string | null)[] = [];
mock.module("../lib/crowdsource", () => ({
	...realCrowd,
	processReport: async (_b: string, codes: string[], _w: number, _t: number, key: string | null) => {
		seen.push(key);
		return { triggeredCodes: [], codeCounts: Object.fromEntries(codes.map((c) => [c, 1])), duplicateCodes: [] };
	},
}));

const { INTERNAL_REQUEST_SECRET } = await import("../config");
// @ts-expect-error -- real files, not other tests' mocks
const F = (await import("../lib/fishermen.ts?real-for-wa-sync")) as typeof import("../lib/fishermen");
// @ts-expect-error
const { default: submit } = (await import("./report-submit.ts?real-for-wa-sync")) as typeof import("./report-submit");
// @ts-expect-error
const { senderOf, default: webhook } = (await import("./openclaw-webhook.ts?real-for-wa-sync")) as typeof import("./openclaw-webhook");
// @ts-expect-error
const W = (await import("../lib/wa-sync.ts?real-for-wa-sync")) as typeof import("../lib/wa-sync");
// @ts-expect-error
const { loadActivity } = (await import("../lib/adaptive-profile.ts?real-for-wa-sync")) as typeof import("../lib/adaptive-profile");

const app = new Hono().route("/api", submit);
const waReport = (number: string, signs: string, internal = true) =>
	app.request(`/api/report/submit?beach_location=pantai_lampuuk&lik_codes=${signs}&channel=WA&reporter=${encodeURIComponent(number)}`,
		{ headers: internal ? { "X-Internal-Key": INTERNAL_REQUEST_SECRET } : {} });

const PROFILE = {
	birth_year: 1980, fishing_start_year: 2000, fishing_role: 1, head_of_community: 0, fishing_duration: 1,
	hazards: ["angin_kencang"], disaster_interaction: 1, lik_combination_count: 2, lik_start_year: 2005,
	usage_frequency_min: 1, usage_frequency_max: 2,
};
const count = (sql: string) => (sqlite.query(sql).get() as { n: number }).n;

describe("WhatsApp sender", () => {
	test("in a group the sender number is used, never the group id", () => {
		expect(senderOf({ from: "120363406080394106@g.us", sender: "+6281234567890" })).toBe("+6281234567890");
		expect(senderOf({ from: "120363406080394106@g.us" })).toBeUndefined();
		expect(senderOf({ from: "6281234567890@s.whatsapp.net" })).toBe("6281234567890@s.whatsapp.net");
	});

	test("the relay hook sends metadata.senderE164 as the sender", async () => {
		const sent: any[] = [];
		const orig = globalThis.fetch;
		globalThis.fetch = (async (_u: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body))); return new Response("{}"); }) as typeof fetch;
		const { default: handler } = await import("../../../openclaw-hooks/webhook-relay/handler.ts");
		await handler({ type: "message", action: "received", sessionKey: "agent:main:whatsapp:group:1203@g.us",
			context: { from: "1203@g.us", content: "!lapor kilat di lampuuk", channelId: "whatsapp", messageId: "m1", metadata: { senderE164: "+6281234567890" } } });
		globalThis.fetch = orig;
		expect(sent[0].sender).toBe("+6281234567890");
		expect(sent[0].messageId).toBe("m1");
	});
});

describe("one history per fisherman across app and WhatsApp", () => {
	test("WhatsApp reports before registration are held (hashed), then join his history with their time", async () => {
		sqlite.run(`DELETE FROM wa_held`);
		const r1 = await (await waReport("+6281234567890", "Wn-3")).json() as any;
		expect(r1.registered).toBe(false);
		expect(r1.heldForRegistration).toBe(true);
		expect(count(`SELECT COUNT(*) AS n FROM wa_held`)).toBe(1);
		// the number itself is not stored
		expect(JSON.stringify(sqlite.query(`SELECT * FROM wa_held`).all())).not.toContain("81234567890");

		sqlite.run(`UPDATE wa_held SET created_at = datetime('now', '-3 days')`);
		const reg = await F.registerFisherman({ phone: "0812-3456-7890", homeBeach: "pantai_lampuuk", consent: true, profile: PROFILE });
		expect(reg.ok).toBe(true);
		const id = (reg as any).fisherman.id;
		expect(count(`SELECT COUNT(*) AS n FROM wa_held`)).toBe(0);
		const row = sqlite.query(`SELECT channel, signs, created_at FROM fisherman_reports WHERE fisherman_id = '${id}'`).get() as any;
		expect(row.channel).toBe("WHATSAPP");
		expect(JSON.parse(row.signs)).toEqual(["Wn-3"]);
		expect(Date.now() - Date.parse(row.created_at.replace(" ", "T") + "Z")).toBeGreaterThan(2.5 * 86_400_000);
	});

	test("after registration, his WhatsApp reports carry the same identity as his app reports", async () => {
		const me = F.findFishermanByPhone("6281234567890")!;
		seen.length = 0;
		const r = await (await waReport("6281234567890@s.whatsapp.net", "Wn-8")).json() as any;
		expect(r.registered).toBe(true);
		expect(seen[0]).toBe(F.fishermanReporterKey(me)); // the same "fisher:<id>" as the app uses
		const act = loadActivity(me.id);
		expect(act.signs_12m).toEqual(["Wn-3", "Wn-8"]);
		expect(act.reports_30d).toBe(2);
	});

	test("a reporter number from the public URL is ignored (cannot report in his name)", async () => {
		const me = F.findFishermanByPhone("6281234567890")!;
		const before = count(`SELECT COUNT(*) AS n FROM fisherman_reports WHERE fisherman_id = '${me.id}'`);
		const r = await (await waReport("6281234567890", "Wn-1", false)).json() as any;
		expect(r.registered).toBe(false);
		expect(count(`SELECT COUNT(*) AS n FROM fisherman_reports WHERE fisherman_id = '${me.id}'`)).toBe(before);
	});
});

describe("!kejadian in the WhatsApp group", () => {
	const hook = new Hono().route("/api", webhook);
	const say = (text: string, sender: string, messageId: string) =>
		hook.request("/api/openclaw/webhook", { method: "POST", headers: { "content-type": "application/json" },
			body: JSON.stringify({ direction: "incoming", from: "1203@g.us", to: "1203@g.us", sender, text, messageId }) });

	test("from a registered number it is his incident (profile + Trust Index), at his home beach if none named", async () => {
		const me = F.findFishermanByPhone("6281234567890")!;
		replies.length = 0;
		await say("!kejadian angin kencang, ombak besar", "+6281234567890", "k1");
		const rows = sqlite.query(`SELECT type, beach, detected_by_sign AS d FROM incidents WHERE fisherman_id = '${me.id}' ORDER BY type`).all();
		expect(rows).toEqual([
			{ type: "angin_kencang", beach: "pantai_lampuuk", d: 1 }, // he reported Wn-8 there just before
			{ type: "gelombang_ekstrem", beach: "pantai_lampuuk", d: 1 },
		]);
		expect(replies[0]).toContain("Kejadian dicatat");
		expect(replies[0]).not.toContain("belum terdaftar");
		expect(loadActivity(me.id).interaction_incidents).toBe(1); // strong wind only (codebook No. 14)
	});

	test("from an unregistered number it is held and joins his history when he registers", async () => {
		replies.length = 0;
		await say("!kejadian badai di lhoknga", "+6285200001111", "k2");
		expect(replies[0]).toContain("belum terdaftar");
		expect(count(`SELECT COUNT(*) AS n FROM wa_held WHERE kind = 'incident'`)).toBe(1);
		const reg = await F.registerFisherman({ phone: "085200001111", homeBeach: "pantai_lhoknga", consent: true, profile: PROFILE });
		const id = (reg as any).fisherman.id;
		// Registration links held items; called again on this file's own module copy because Bun
		// shares module mocks between test files (a no-op when registration already linked them).
		const held = sqlite.query(`SELECT phone_hash AS h FROM wa_held`).get() as { h: string } | null;
		if (held) W.linkHeldWhatsApp(id, held.h);
		expect(sqlite.query(`SELECT type, beach FROM incidents WHERE fisherman_id = '${id}'`).all()).toEqual([{ type: "badai", beach: "pantai_lhoknga" }]);
	});

	test("lapor receipts tell an unregistered sender to register with this number", async () => {
		replies.length = 0;
		const orig = globalThis.fetch;
		globalThis.fetch = ((u: string, init?: RequestInit) => app.request(String(u).replace("http://localhost:3000", ""), init)) as typeof fetch;
		await say("!lapor kilat di lampuuk", "+6289911112222", "l1");
		globalThis.fetch = orig;
		expect(replies[0]).toContain("Laporan diterima");
		expect(replies[0]).toContain("belum terdaftar");
	});
});
