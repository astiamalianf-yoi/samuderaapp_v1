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
const A = (await import("./adaptive-profile.ts?real-adaptive")) as typeof import("./adaptive-profile");

const answers = {
	birth_year: 1981, fishing_start_year: 2001, lik_start_year: 2010, fishing_role: 1, head_of_community: 0,
	fishing_duration: 1, hazards: ["angin_kencang"], disaster_interaction: 3, lik_combination_count: 2,
	usage_frequency_min: 2, usage_frequency_max: 4,
};
const none = { reports_30d: 0, signs_12m: [], incidents_total: 0, incident_hazards: [] };

describe("answers by year", () => {
	test("age, fishing experience and years using signs grow with the calendar year", () => {
		const a = A.parseAnswers(answers, 2026)!;
		expect(A.effectiveProfile(a, none, 2026)).toMatchObject({ age: 45, fishing_experience: 25, usage_duration: 16 });
		expect(A.effectiveProfile(a, none, 2027)).toMatchObject({ age: 46, fishing_experience: 26, usage_duration: 17 });
	});
	test("implausible years are refused", () => {
		expect(A.parseAnswers({ ...answers, birth_year: 2020 }, 2026)).toBeNull();          // younger than 10
		expect(A.parseAnswers({ ...answers, fishing_start_year: 1975 }, 2026)).toBeNull();  // before birth
		expect(A.parseAnswers({ ...answers, usage_frequency_min: 9 }, 2026)).toBeNull();    // min > max
	});
	test("WIB year: 31 Dec 18:00 UTC is already the new year in Indonesia", () => {
		expect(A.currentYear(new Date("2026-12-31T18:00:00Z"))).toBe(2027);
	});
});

describe("activity only raises values", () => {
	const a = A.parseAnswers(answers, 2026)!;
	test("more reports this month than he said raises frequency (max); fewer does not lower it", () => {
		expect(A.effectiveProfile(a, { ...none, reports_30d: 9 }, 2026).usage_frequency_max).toBe(9);
		expect(A.effectiveProfile(a, { ...none, reports_30d: 1 }, 2026).usage_frequency_max).toBe(4);
	});
	test("different signs reported raise the number of signs used", () => {
		expect(A.effectiveProfile(a, { ...none, signs_12m: ["Wn-1", "Wn-3", "Wn-4"] }, 2026).lik_combination_count).toBe(3);
		expect(A.effectiveProfile(a, { ...none, signs_12m: ["Wn-1"] }, 2026).lik_combination_count).toBe(2);
	});
	test("each incident adds 1 interaction; a new hazard type adds to the hazards lived", () => {
		const p = A.effectiveProfile(a, { ...none, incidents_total: 2, incident_hazards: ["angin_kencang", "badai"] }, 2026);
		expect(p.disaster_interaction).toBe(5);
		expect(p.disaster_experience_count).toBe(2); // angin_kencang (already) + badai (new)
	});
	test("a burst of repeated reports counts once (5-minute spacing)", () => {
		const t = 1_000_000;
		expect(A.spacedCount([t, t + 60_000, t + 120_000, t + 10 * 60_000])).toBe(2);
	});
});

describe("activity from the database", () => {
	test("reports and incidents of the fisherman are counted", () => {
		sqlite.run(`INSERT INTO fishermen (id, phone_hash, phone_last4, home_beach, token_hash, consent_at) VALUES ('f1','h','1234','pantai_lampuuk','t','now')`);
		A.logFishermanReport("f1", "pantai_lampuuk", ["Wn-3"], "PWA", true);
		A.logFishermanReport("f1", "pantai_lampuuk", ["Wn-4", "Wn-3"], "WHATSAPP", true);
		sqlite.run(`INSERT INTO incidents (id, fisherman_id, beach, type) VALUES ('i1','f1','pantai_lampuuk','badai')`);
		const act = A.loadActivity("f1");
		expect(act.reports_30d).toBe(1); // both within 5 minutes
		expect(act.signs_12m).toEqual(["Wn-3", "Wn-4"]);
		expect(act.incidents_total).toBe(1);
		expect(act.incident_hazards).toEqual(["badai"]);
	});
});
