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
const none = { reports_30d: 0, reports_min_3m: 0, signs_12m: [], incidents_total: 0, interaction_incidents: 0, incident_hazards: [] as ("angin_kencang" | "badai")[] };

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
	test("strong-wind incidents add interaction (No. 14); detected hazard types add experience (No. 12-13)", () => {
		const p = A.effectiveProfile(a, { ...none, incidents_total: 3, interaction_incidents: 2, incident_hazards: ["angin_kencang", "badai"] }, 2026);
		expect(p.disaster_interaction).toBe(5);
		expect(p.disaster_experience_count).toBe(2); // angin_kencang (already) + badai (new)
	});
	test("frequency (min) rises to the lowest month of the last three, never above max", () => {
		const p = A.effectiveProfile(a, { ...none, reports_30d: 9, reports_min_3m: 5 }, 2026);
		expect(p.usage_frequency_min).toBe(5);
		expect(p.usage_frequency_max).toBe(9);
		expect(A.effectiveProfile(a, { ...none, reports_30d: 9, reports_min_3m: 0 }, 2026).usage_frequency_min).toBe(2); // his answer
	});
	test("old hazard keys are mapped to codebook codes; gempa (not in the codebook) is dropped", () => {
		const old = A.parseAnswers({ ...answers, hazards: ["gelombang_tinggi", "banjir_rob", "gempa"] }, 2026)!;
		expect(old.hazards.sort()).toEqual(["gelombang_ekstrem", "pasang_tinggi"]);
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
		sqlite.run(`INSERT INTO incidents (id, fisherman_id, beach, type, detected_by_sign) VALUES ('i1','f1','pantai_lampuuk','badai',1)`);
		sqlite.run(`INSERT INTO incidents (id, fisherman_id, beach, type, detected_by_sign) VALUES ('i2','f1','pantai_lampuuk','arus_kuat',0)`);
		sqlite.run(`INSERT INTO incidents (id, fisherman_id, beach, type, detected_by_sign) VALUES ('i3','f1','pantai_lampuuk','gelombang_ekstrem',1)`);
		const act = A.loadActivity("f1");
		expect(act.reports_30d).toBe(1); // both within 5 minutes
		expect(act.reports_min_3m).toBe(0); // no reports 1-3 months ago
		expect(act.signs_12m).toEqual(["Wn-3", "Wn-4"]);
		expect(act.incidents_total).toBe(3);
		expect(act.interaction_incidents).toBe(1); // only the storm is strong wind
		expect(act.incident_hazards.sort()).toEqual(["badai", "gelombang_ekstrem"]); // arus_kuat not detected by a sign
	});
});

describe("three-month windows", () => {
	test("min = lowest month: reports in each of the last 3 months", () => {
		sqlite.run(`INSERT INTO fishermen (id, phone_hash, phone_last4, home_beach, token_hash, consent_at) VALUES ('f2','h2','5678','pantai_lampuuk','t2','now')`);
		const now = new Date("2026-11-07T10:00:00Z");
		const at = (daysAgo: number, k: number) => new Date(now.getTime() - daysAgo * 86_400_000 - k * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
		const add = (daysAgo: number, n: number) => {
			for (let k = 0; k < n; k++) sqlite.run(`INSERT INTO fisherman_reports (fisherman_id, beach, signs, channel, counted, created_at) VALUES ('f2','pantai_lampuuk','["Wn-1"]','PWA',1,'${at(daysAgo, k)}')`);
		};
		add(5, 7);   // this month: 7
		add(40, 4);  // 1 month ago: 4
		add(70, 6);  // 2 months ago: 6
		const act = A.loadActivity("f2", now);
		expect(act.reports_30d).toBe(7);
		expect(act.reports_min_3m).toBe(4);
	});
});
