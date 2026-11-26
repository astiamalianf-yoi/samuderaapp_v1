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
const H = (await import("./trust-history.ts?real-trust-history")) as typeof import("./trust-history");
const { computeTrustIndex } = await import("./trust-index");

const rows = () => sqlite.query("select high, low, signs from trust_index_history order by id").all() as { high: string; low: string; signs: string }[];

describe("Trust Index history (26 Nov 2026)", () => {
	test("the first index is written; the same index again is not", () => {
		const r = computeTrustIndex([], "adaptive");
		expect(H.recordTrustIndex(r)).toBe(true);
		expect(H.recordTrustIndex(r)).toBe(false);
		expect(rows()).toHaveLength(1);
		expect(JSON.parse(rows()[0]!.high)).toEqual(r.high);
	});
	test("a change in the app records writes a new row with the new scores and tiers", () => {
		const recs = Array.from({ length: 30 }, () => ({ sign: "Wn-13", predictions: 4, confirmed: 4 }));
		const r = computeTrustIndex(recs, "adaptive");
		expect(H.recordTrustIndex(r)).toBe(true);
		const last = JSON.parse(rows().at(-1)!.signs) as { code: string; appRecords: number }[];
		expect(last.find((s) => s.code === "Wn-13")!.appRecords).toBe(30);
	});
});
