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
const S = (await import("./bmkg-snapshot.ts?real-bmkg-snapshot")) as typeof import("./bmkg-snapshot");

describe("hourly BMKG snapshot per field beach (26 Nov 2026)", () => {
	test("the three Aceh beaches by default", () => {
		expect(S.SNAPSHOT_BEACHES).toEqual(["pantai_lampuuk", "pantai_lhoknga", "pantai_ulee_lheue"]);
	});
	test("one row per beach; wind and safety kept; a missing forecast and a simulation are marked", async () => {
		const fetch = async (b: string) => b === "pantai_lhoknga" ? null : ({ beach: b, windSpeed: b === "pantai_lampuuk" ? 34 : 12, windDirection: "W", weatherCode: 3, weather: "Berawan", isSafe: b !== "pantai_lampuuk", periodStart: null, periodEnd: null } as any);
		const n = await S.takeBmkgSnapshots(["pantai_lampuuk", "pantai_lhoknga", "pantai_ulee_lheue"], fetch, async (b) => b === "pantai_ulee_lheue");
		expect(n).toBe(3);
		const rows = (sqlite.query("select weather from bmkg_snapshots order by id").all() as { weather: string }[]).map((r) => JSON.parse(r.weather));
		expect(rows[0]).toMatchObject({ beach: "pantai_lampuuk", available: true, windSpeed: 34, isSafe: false, simulated: false });
		expect(rows[1]).toMatchObject({ beach: "pantai_lhoknga", available: false });
		expect(rows[2]).toMatchObject({ beach: "pantai_ulee_lheue", windSpeed: 12, isSafe: true, simulated: true });
	});
});
