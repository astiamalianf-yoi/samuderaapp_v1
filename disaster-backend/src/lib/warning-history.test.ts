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
const W = (await import("./warning-history.ts?real-warning-history")) as typeof import("./warning-history");

const st = (level: string, lik: { level: string; codes: string[]; reporters: number; endsAt: number } | null, official: string[] = [], forecastLevel = "NORMAL") => ({
	beach: "pantai_lampuuk", level, lik: lik ? { ...lik, triggeredAt: 0 } : null,
	bmkg: { level: official.length ? "SIAGA" : forecastLevel, forecastLevel, warnings: official.map((e) => ({ event: e, expires: null })), weather: null, windSpeed: 20, windDirection: null, temperature: null, periodStart: null, periodEnd: null },
}) as any;
const rows = () => sqlite.query("select level, prev_level, cause from warning_level_history order by id").all() as { level: string; prev_level: string | null; cause: string }[];

describe("warning level history (26 Nov 2026)", () => {
	test("a warning that rises and falls is followed step by step, with what changed", async () => {
		const T = Date.parse("2026-12-06T06:00:00+07:00");
		const steps = [
			st("NORMAL", null),
			st("WASPADA", { level: "WASPADA", codes: ["Wn-1"], reporters: 1, endsAt: T + 3 * 3600_000 }),
			st("WASPADA", { level: "WASPADA", codes: ["Wn-1"], reporters: 1, endsAt: T + 3 * 3600_000 }),
			st("SIAGA", { level: "SIAGA", codes: ["Wn-1", "Wn-3"], reporters: 2, endsAt: T + 5 * 3600_000 }),
			st("EKSTREM", { level: "SIAGA", codes: ["Wn-1", "Wn-3"], reporters: 2, endsAt: T + 5 * 3600_000 }, ["Peringatan Dini Cuaca"]),
			st("SIAGA", { level: "SIAGA", codes: ["Wn-1", "Wn-3"], reporters: 2, endsAt: T + 5 * 3600_000 }, []),
			st("NORMAL", null),
		];
		for (const s of steps) await W.recordWarningLevels(["pantai_lampuuk"], async () => s, async () => false);
		expect(rows()).toEqual([
			{ level: "WASPADA", prev_level: null, cause: "lik_started level_up" },
			{ level: "SIAGA", prev_level: "WASPADA", cause: "lik_up reporters_up signs_changed end_time_changed level_up" },
			{ level: "EKSTREM", prev_level: "SIAGA", cause: "official_started level_up" },
			{ level: "SIAGA", prev_level: "EKSTREM", cause: "official_ended level_down" },
			{ level: "NORMAL", prev_level: "SIAGA", cause: "lik_ended level_down" },
		]);
	});
	test("a BMKG forecast alone is logged too", () => {
		const prev = W.rowFromStatus(st("NORMAL", null));
		expect(W.causeOf(prev, W.rowFromStatus(st("WASPADA", null, [], "WASPADA")))).toBe("forecast_up level_up");
	});
});
