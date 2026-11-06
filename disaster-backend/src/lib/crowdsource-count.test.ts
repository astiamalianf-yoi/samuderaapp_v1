import { describe, expect, mock, test, beforeEach } from "bun:test";

// In-memory stand-in for the few Redis commands the counting uses.
let zsets = new Map<string, { score: number; value: string }[]>();
let keys = new Map<string, number>(); // key -> expiry (ms)
let clock = 1_000_000;

const fakeRedis = {
	set: async (key: string, _v: string, opts: { NX?: boolean; PX?: number; EX?: number }) => {
		const exp = keys.get(key);
		if (opts.NX && exp !== undefined && exp > clock) return null;
		keys.set(key, clock + (opts.PX ?? (opts.EX ?? 3600) * 1000));
		return "OK";
	},
	zAdd: async (key: string, m: { score: number; value: string }) => {
		zsets.set(key, [...(zsets.get(key) ?? []), m]);
	},
	zRemRangeByScore: async (key: string, min: number, max: number) => {
		zsets.set(key, (zsets.get(key) ?? []).filter((m) => m.score < min || m.score > max));
	},
	zCard: async (key: string) => (zsets.get(key) ?? []).length,
	zRange: async (key: string) => (zsets.get(key) ?? []).map((m) => m.value),
};

mock.module("./redis", () => ({ redis: fakeRedis }));
// Other test files replace "../lib/crowdsource" with a mock; load the real file under its own path.
// @ts-expect-error -- the query string only makes Bun load the real file instead of the mock
const { processReport, reporterKeyFor, countReporters } = (await import("./crowdsource.ts?real-count")) as typeof import("./crowdsource");

const realNow = Date.now;
const DAY = 24 * 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

async function report(who: string | null, code = "Wn-4", beach = "pantai_depok") {
	Date.now = () => clock;
	try {
		return await processReport(beach, [code], DAY, 5, who, FIVE_MIN);
	} finally {
		Date.now = realNow;
	}
}

beforeEach(() => {
	zsets = new Map();
	keys = new Map();
	clock = 1_000_000;
});

describe("reporterKeyFor", () => {
	test("WhatsApp numbers are normalised; a group id is not a person", () => {
		expect(reporterKeyFor({ waSender: "6281234567890@s.whatsapp.net" })).toBe("wa:6281234567890");
		expect(reporterKeyFor({ waSender: "+62 812-3456-7890" })).toBe("wa:6281234567890");
		expect(reporterKeyFor({ waSender: "120363406080394106@g.us" })).toBeNull();
	});
	test("logged-in user wins over device id", () => {
		expect(reporterKeyFor({ userId: "u1", deviceId: "5f1c2b9e-1111-4222-8333-444455556666" })).toBe("user:u1");
		expect(reporterKeyFor({ deviceId: "5F1C2B9E-1111-4222-8333-444455556666" })).toBe(
			"device:5f1c2b9e-1111-4222-8333-444455556666",
		);
		expect(reporterKeyFor({})).toBeNull();
	});
});

describe("five-report rule with the 5-minute repeat window", () => {
	test("the same person, same sign, within 5 minutes counts once", async () => {
		const a = await report("wa:62811");
		clock += 60_000;
		const b = await report("wa:62811");
		clock += 3 * 60_000;
		const c = await report("wa:62811");
		expect(a.codeCounts["Wn-4"]).toBe(1);
		expect(b.codeCounts["Wn-4"]).toBe(1);
		expect(b.duplicateCodes).toEqual(["Wn-4"]);
		expect(c.codeCounts["Wn-4"]).toBe(1);
	});

	test("after 5 minutes the same person counts again", async () => {
		await report("wa:62811");
		clock += FIVE_MIN + 1;
		const again = await report("wa:62811");
		expect(again.duplicateCodes).toEqual([]);
		expect(again.codeCounts["Wn-4"]).toBe(2);
	});

	test("app and WhatsApp reports count together (Dhimas WA + Asti WA + one app phone = 3)", async () => {
		await report("wa:62811");
		await report("wa:62822");
		const r = await report("device:5f1c2b9e-1111-4222-8333-444455556666");
		expect(r.codeCounts["Wn-4"]).toBe(3);
		expect(await countReporters("pantai_depok", ["Wn-4"])).toBe(3);
	});

	test("one tester repeating a message cannot reach the threshold alone", async () => {
		let last;
		for (let i = 0; i < 5; i++) {
			last = await report("wa:62811");
			clock += 10_000;
		}
		expect(last!.codeCounts["Wn-4"]).toBe(1);
		expect(last!.triggeredCodes).toEqual([]);
	});

	test("five different people trigger; a different sign is a separate report", async () => {
		const other = await report("wa:62811", "Wn-3");
		expect(other.duplicateCodes).toEqual([]);
		let last;
		for (const who of ["wa:1111111", "wa:2222222", "wa:3333333", "device:abcdef12-0000-4000-8000-000000000000", "wa:62811"]) {
			last = await report(who);
		}
		expect(last!.triggeredCodes).toEqual(["Wn-4"]);
		expect(await countReporters("pantai_depok", ["Wn-4"])).toBe(5);
	});

	test("reports without any identity are each counted (old behaviour)", async () => {
		await report(null);
		const r = await report(null);
		expect(r.codeCounts["Wn-4"]).toBe(2);
		expect(await countReporters("pantai_depok", ["Wn-4"])).toBe(2);
	});
});
