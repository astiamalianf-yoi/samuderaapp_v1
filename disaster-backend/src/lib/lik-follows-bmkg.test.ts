import { describe, expect, mock, test } from "bun:test";

// Minimal in-memory Redis: values with an expiry (ms).
const store = new Map<string, { v: string; exp: number }>();
let clock = Date.UTC(2026, 10, 14, 3, 0);
const fakeRedis = {
	get: async (k: string) => { const e = store.get(k); return e && e.exp > clock ? e.v : null; },
	set: async (k: string, v: string, o: { EX?: number }) => { store.set(k, { v, exp: clock + (o.EX ?? 3600) * 1000 }); return "OK"; },
	del: async (k: string) => { store.delete(k); return 1; },
	ttl: async (k: string) => { const e = store.get(k); return e ? Math.ceil((e.exp - clock) / 1000) : -2; },
};
mock.module("./redis", () => ({ redis: fakeRedis }));
// @ts-expect-error -- the query string only makes Bun load the real file
const C = (await import("./crowdsource.ts?real-follow")) as typeof import("./crowdsource");

const H = 3600_000;
const realNow = Date.now;

async function start() {
	store.clear();
	Date.now = () => clock;
	await C.setActiveWarning("pantai_lampuuk", ["Wn-5"], "a1", 3600);
	Date.now = realNow;
}
const end = async () => (await C.getActiveWarning("pantai_lampuuk"))?.expiresAt ?? null;

describe("a fishermen's warning follows BMKG (14 Nov 2026)", () => {
	test("BMKG arrives after 30 minutes and ends after 4 hours: extended to BMKG's end", async () => {
		await start();
		expect(await end()).toBe(clock + H);
		expect(await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 4 * H, clock + 0.5 * H)).toBe(clock + 4 * H);
		expect(await end()).toBe(clock + 4 * H);
	});
	test("BMKG withdrawn early (after 2 hours): ends together with BMKG", async () => {
		await start();
		await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 4 * H, clock + 0.5 * H);
		const t = clock;
		clock = t + 2 * H; // own hour has passed
		expect(await C.syncActiveWarningWithBmkg("pantai_lampuuk", null, clock)).toBeNull();
		expect(await C.getActiveWarning("pantai_lampuuk")).toBeNull();
		clock = t;
	});
	test("BMKG ends within the warning's own hour: back to its own hour, not shorter", async () => {
		await start();
		await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 4 * H, clock + 0.25 * H);
		expect(await C.syncActiveWarningWithBmkg("pantai_lampuuk", null, clock + 0.5 * H)).toBe(clock + H);
		expect(await end()).toBe(clock + H);
	});
	test("BMKG shortens its end time: follows the shorter end", async () => {
		await start();
		await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 4 * H, clock + 0.25 * H);
		expect(await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 2 * H, clock + 0.5 * H)).toBe(clock + 2 * H);
	});
	test("no active fishermen's warning: BMKG does not create one", async () => {
		store.clear();
		expect(await C.syncActiveWarningWithBmkg("pantai_lampuuk", clock + 4 * H, clock)).toBeUndefined();
		expect(await C.getActiveWarning("pantai_lampuuk")).toBeNull();
	});
});
