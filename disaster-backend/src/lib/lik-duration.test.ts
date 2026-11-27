import { describe, expect, mock, test } from "bun:test";

let bmkg: { expires: number | null }[] = [];
mock.module("./bmkg-nowcast", () => ({ getActiveNowcast: async () => bmkg }));
// @ts-expect-error -- the query string only makes Bun load the real file
const L = (await import("./lik-duration.ts?real-lik")) as typeof import("./lik-duration");

describe("how long a fishermen's warning lasts (14 Nov 2026)", () => {
	const now = Date.UTC(2026, 10, 14, 3, 0);
	test("on its own: 1 hour for every sign", async () => {
		bmkg = [];
		expect(await L.likWarningTtlSeconds("pantai_lampuuk", now)).toBe(3600);
	});
	test("with a BMKG warning covering the beach that ends later: until BMKG's end", async () => {
		bmkg = [{ expires: now + 3 * 3600_000 }];
		expect(await L.likWarningTtlSeconds("pantai_lampuuk", now)).toBe(3 * 3600);
	});
	test("a BMKG warning ending sooner does not shorten it below 1 hour", async () => {
		bmkg = [{ expires: now + 20 * 60_000 }];
		expect(await L.likWarningTtlSeconds("pantai_lampuuk", now)).toBe(3600);
	});
});
