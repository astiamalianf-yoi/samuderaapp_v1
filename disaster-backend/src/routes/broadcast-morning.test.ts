import { describe, expect, mock, test } from "bun:test";

const calls: unknown[][] = [];
mock.module("../lib/group-alert", () => ({
	groupMessageFor: async (...a: unknown[]) => { calls.push(a); return `*STATUS LAUT HARI INI*\nLokasi: ${a[0]}`; },
}));
// @ts-expect-error -- the query string only makes Bun load the real file
const M = (await import("./broadcast-morning.ts?real-morning")) as typeof import("./broadcast-morning");

describe("morning message = the current final card of the group's beach (27 Nov 2026)", () => {
	test("greeting, the beach's own card from the warning wording, and sun / moon", async () => {
		const msg = await M.buildMorningFor(["pantai_lhoknga"], { sunrise: "06:31", sunset: "18:29", moonPhase: "Bulan Purnama" });
		expect(msg.startsWith("🌅 *SELAMAT PAGI*")).toBe(true);
		expect(msg).toContain("Lokasi: pantai_lhoknga");
		expect(msg).not.toContain("pantai_lampuuk");
		expect(msg).toContain("Matahari terbit 06:31 WIB");
		expect(msg).toContain("Fase bulan: Bulan Purnama");
	});
	test("it is not counted as a sent warning (no AMAN message follows from it)", async () => {
		calls.length = 0;
		await M.buildMorningFor(["pantai_lampuuk"], null);
		expect(calls[0]).toEqual(["pantai_lampuuk", null, undefined, { mark: false }]);
	});
});
