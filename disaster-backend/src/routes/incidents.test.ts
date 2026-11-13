import { describe, expect, mock, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Hono } from "hono";
import path from "path";
import * as schema from "../db/schema";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(import.meta.dir, "..", "db", "migrations") });
sqlite.run(`INSERT INTO fishermen (id, phone_hash, phone_last4, home_beach, token_hash, consent_at) VALUES ('f1','h','7890','pantai_lampuuk','t','now')`);

const sent: string[] = [];
const keys = new Set<string>();
mock.module("../db", () => ({ initDb: () => db, getDb: () => db, schema }));
mock.module("../lib/openclaw", () => ({
	sendOpenClawAlert: async (t: string) => { sent.push(t); },
	sendOpenClawBeachAlert: async (_beach: string, t: string) => { sent.push(t); },
	sendOpenClawToGroups: async () => {},
	sendOpenClawReply: async () => {},
	beachForGroup: () => null,
	groupsForBeach: () => [],
	beachesByGroup: () => new Map(),
}));
mock.module("../lib/redis", () => ({
	redis: { set: async (k: string, _v: string, o: { NX?: boolean }) => (o.NX && keys.has(k) ? null : (keys.add(k), "OK")) },
}));
mock.module("../lib/class-history", () => ({ recordClass: async () => {} }));
// Full real module, with only the token lookup and phone parsing replaced (other test files share it).
// @ts-expect-error -- the query string only makes Bun load the real file
const realFishermen = (await import("../lib/fishermen.ts?real-for-incidents")) as typeof import("../lib/fishermen");
mock.module("../lib/fishermen", () => ({
	...realFishermen,
	findFishermanByToken: (t: string | null) => (t === "good-token-xxxxxxxxxxxxxxxx" ? { id: "f1", homeBeach: "pantai_lampuuk", profile: null } : null),
	normalizePhone: (raw: string | null) => (raw ? "6281234567890" : null),
}));

// @ts-expect-error -- the query string only makes Bun load the real file
const { default: route, formatHelpMessage } = (await import("./incidents.ts?real-incidents")) as typeof import("./incidents");
const app = new Hono().route("/api", route);
const post = (body: unknown, token = "good-token-xxxxxxxxxxxxxxxx") =>
	app.request("/api/incidents", { method: "POST", headers: { "content-type": "application/json", "x-fisherman-token": token }, body: JSON.stringify(body) });

beforeEach(() => { sent.length = 0; keys.clear(); });

describe("Lapor kejadian / Minta bantuan", () => {
	test("help message has beach, what happened, map link, number and emergency numbers", () => {
		const t = formatHelpMessage({ beach: "pantai_lampuuk", type: "angin_kencang", lat: 5.4955, lon: 95.2401, phone: "6281234567890", at: new Date("2026-11-07T09:45:00Z") });
		expect(t).toContain("NELAYAN BUTUH BANTUAN");
		expect(t).toContain("Pantai Lampuuk");
		expect(t).toContain("Angin kencang di laut");
		expect(t).toContain("https://maps.google.com/?q=5.49550,95.24010");
		expect(t).toContain("0812-3456-7890");
		expect(t).toContain("16.45 WIB");
		expect(t).toContain("115");
	});

	test("without a location the message says why: not shared, permission denied, or no GPS fix", () => {
		const base = { beach: "pantai_lampuuk", type: "angin_kencang" as const };
		expect(formatHelpMessage(base)).toContain("Lokasi tidak dibagikan");
		expect(formatHelpMessage({ ...base, locationStatus: "denied" })).toContain("izin lokasi di HP ditolak");
		expect(formatHelpMessage({ ...base, locationStatus: "unavailable" })).toContain("GPS HP belum mendapat posisi");
	});

	test("an incident without help is recorded and nothing is sent to the group", async () => {
		const res = await post({ beach: "pantai_lampuuk", type: "badai", needHelp: false });
		expect(res.status).toBe(201);
		expect(sent.length).toBe(0);
		expect(sqlite.query("SELECT COUNT(*) AS n FROM incidents").get()).toEqual({ n: 1 });
	});

	test("'saw a sign before' is read from his own reports, not asked", async () => {
		sqlite.run(`DELETE FROM incidents`);
		await post({ beach: "pantai_lampuuk", type: "angin_kencang", needHelp: false, detectedBySign: true });
		expect(sqlite.query("SELECT detected_by_sign AS d FROM incidents").get()).toEqual({ d: 0 });
		sqlite.run(`INSERT INTO fisherman_reports (fisherman_id, beach, signs, channel, counted) VALUES ('f1','pantai_lampuuk','["Wn-3"]','PWA',1)`);
		await post({ beach: "pantai_lampuuk", type: "badai", needHelp: false });
		expect(sqlite.query("SELECT detected_by_sign AS d FROM incidents WHERE type = 'badai'").get()).toEqual({ d: 1 });
		sqlite.run(`DELETE FROM fisherman_reports`);
	});

	test("help is sent once; tapping again within 10 minutes does not spam the group", async () => {
		const a = await (await post({ beach: "pantai_lampuuk", type: "angin_kencang", needHelp: true, contactPhone: "0812" })).json() as { helpSent: boolean };
		const b = await (await post({ beach: "pantai_lampuuk", type: "angin_kencang", needHelp: true })).json() as { helpSent: boolean; helpReason: string };
		expect(a.helpSent).toBe(true);
		expect(b.helpSent).toBe(false);
		expect(b.helpReason).toBe("already_sent");
		expect(sent.length).toBe(1);
	});

	test("needs registration; rejects unknown beach or type", async () => {
		expect((await post({ beach: "pantai_lampuuk", type: "badai" }, "nope")).status).toBe(401);
		expect((await post({ beach: "pantai_kuta", type: "badai" })).status).toBe(400);
		expect((await post({ beach: "pantai_lampuuk", type: "gempa" })).status).toBe(400);
	});
});
