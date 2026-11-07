import { describe, expect, mock, test, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import * as schema from "../db/schema";

// Fresh in-memory database with the real migrations (incl. 0001_fishermen).
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(import.meta.dir, "..", "db", "migrations") });
mock.module("../db", () => ({ initDb: () => db, getDb: () => db, schema }));

// Other test files replace some modules with mocks; load the real file under its own path.
// @ts-expect-error -- the query string only makes Bun load the real file
const F = (await import("./fishermen.ts?real-fishermen")) as typeof import("./fishermen");

const profile = {
	birth_year: 1981, fishing_start_year: 2001, lik_start_year: 2010, fishing_role: 1, head_of_community: 0,
	fishing_duration: 1, hazards: ["angin_kencang", "gelombang_tinggi"], disaster_interaction: 3,
	lik_combination_count: 4, usage_frequency_min: 2, usage_frequency_max: 4,
};

describe("normalizePhone", () => {
	test("Indonesian formats become 62…", () => {
		expect(F.normalizePhone("0812-3456-7890")).toBe("6281234567890");
		expect(F.normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
		expect(F.normalizePhone("81234567890")).toBe("6281234567890");
		expect(F.normalizePhone("6281234567890@s.whatsapp.net")).toBe("6281234567890");
	});
	test("not a person's number", () => {
		expect(F.normalizePhone("120363406080394106@g.us")).toBeNull();
		expect(F.normalizePhone("12345")).toBeNull();
		expect(F.normalizePhone("")).toBeNull();
	});
});

describe("registration", () => {
	let token = "";
	let id = "";

	beforeAll(async () => {
		const res = await F.registerFisherman({ phone: "0812-3456-7890", homeBeach: "pantai_lampuuk", profile, consent: true });
		if (!res.ok) throw new Error(res.error);
		token = res.token;
		id = res.fisherman.id;
	});

	test("the number itself is not stored, only a hash and the last 4 digits", () => {
		const row = sqlite.query("SELECT * FROM fishermen").get() as Record<string, string>;
		expect(JSON.stringify(row)).not.toContain("81234567890");
		expect(row.phone_last4).toBe("7890");
		expect(row.token_hash).not.toBe(token);
	});

	test("refuses missing consent, bad number, unknown beach, incomplete profile", async () => {
		const base = { phone: "081234567891", homeBeach: "pantai_lampuuk", profile, consent: true };
		expect(await F.registerFisherman({ ...base, consent: false })).toEqual({ ok: false, error: "consent_required" });
		expect(await F.registerFisherman({ ...base, phone: "123" })).toEqual({ ok: false, error: "invalid_phone" });
		expect(await F.registerFisherman({ ...base, homeBeach: "pantai_kuta" })).toEqual({ ok: false, error: "invalid_beach" });
		expect(await F.registerFisherman({ ...base, profile: { age: 45 } })).toEqual({ ok: false, error: "invalid_profile" });
		expect(await F.registerFisherman({ ...base, profile: { ...profile, fishing_start_year: 1970 } })).toEqual({ ok: false, error: "invalid_profile" });
	});

	test("the app token and the WhatsApp number find the same fisherman (one reporter key)", () => {
		const byToken = F.findFishermanByToken(token)!;
		const byWa = F.findFishermanByPhone("6281234567890@s.whatsapp.net")!;
		expect(byToken.id).toBe(id);
		expect(byWa.id).toBe(id);
		expect(F.fishermanReporterKey(byToken)).toBe(F.fishermanReporterKey(byWa));
	});

	test("registering the same number again updates him and replaces the token", async () => {
		const again = await F.registerFisherman({ phone: "+6281234567890", homeBeach: "pantai_lhoknga", profile, consent: true });
		if (!again.ok) throw new Error(again.error);
		expect(again.created).toBe(false);
		expect(again.fisherman.id).toBe(id);
		expect(again.fisherman.homeBeach).toBe("pantai_lhoknga");
		expect(F.findFishermanByToken(token)).toBeNull();
		expect(F.findFishermanByToken(again.token)?.id).toBe(id);
	});
});
