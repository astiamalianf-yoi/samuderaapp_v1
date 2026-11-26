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
const E = (await import("./app-events.ts?real-app-events")) as typeof import("./app-events");
const rows = () => sqlite.query("select fisherman_id, event, ref, channel, day from app_events order by id").all() as Record<string, string>[];

describe("usage log (field study, 26 Nov 2026)", () => {
	test("the WIB day: 23.30 WIB is still the same day, 00.10 WIB the next", () => {
		expect(E.wibDay(Date.parse("2026-12-04T23:30:00+07:00"))).toBe("2026-12-04");
		expect(E.wibDay(Date.parse("2026-12-05T00:10:00+07:00"))).toBe("2026-12-05");
	});
	test("opening the app several times on one day is one row; the next day is a new row", () => {
		const at = Date.parse("2026-12-04T06:00:00+07:00");
		expect(E.recordEvent({ fishermanId: "f1", event: "app_open", channel: "APP", at })).toBe(true);
		expect(E.recordEvent({ fishermanId: "f1", event: "app_open", channel: "APP", at: at + 3600_000 })).toBe(false);
		expect(E.recordEvent({ fishermanId: "f1", event: "app_open", channel: "APP", at: at + 24 * 3600_000 })).toBe(true);
		expect(rows().filter((r) => r.event === "app_open").map((r) => r.day)).toEqual(["2026-12-04", "2026-12-05"]);
	});
	test("each warning seen is its own row; bot commands are logged per command", () => {
		const at = Date.parse("2026-12-06T08:00:00+07:00");
		E.recordEvent({ fishermanId: "f2", event: "warning_seen", ref: "pantai_lampuuk:SIAGA:1", channel: "APP", at });
		E.recordEvent({ fishermanId: "f2", event: "warning_seen", ref: "pantai_lampuuk:SIAGA:1", channel: "APP", at });
		E.recordEvent({ fishermanId: "f2", event: "warning_seen", ref: "pantai_lampuuk:EKSTREM:2", channel: "APP", at });
		E.recordEvent({ fishermanId: "f2", event: "wa_command", ref: "peringatan", channel: "WHATSAPP", at });
		E.recordEvent({ fishermanId: "f2", event: "wa_command", ref: "lapor", channel: "WHATSAPP", at });
		const f2 = rows().filter((r) => r.fisherman_id === "f2");
		expect(f2.map((r) => `${r.event}:${r.ref}`)).toEqual([
			"warning_seen:pantai_lampuuk:SIAGA:1", "warning_seen:pantai_lampuuk:EKSTREM:2", "wa_command:peringatan", "wa_command:lapor",
		]);
		expect(f2.find((r) => r.event === "wa_command")!.channel).toBe("WHATSAPP");
	});
});
