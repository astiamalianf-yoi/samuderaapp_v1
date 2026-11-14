import { describe, expect, mock, test } from "bun:test";

const state: { active: Record<string, unknown> | null; nowcast: unknown[]; forecast: Record<string, unknown> | null } = { active: null, nowcast: [], forecast: null };
mock.module("./crowdsource", () => ({ getActiveWarning: async () => state.active }));
mock.module("./bmkg-nowcast", () => ({ getActiveNowcast: async () => state.nowcast }));
mock.module("./bmkg-fetch", () => ({ getBmkgData: async () => state.forecast }));

// @ts-expect-error -- the query string only makes Bun load the real file
const M = (await import("./map-status.ts?real-map")) as typeof import("./map-status");

const calm = { windSpeed: 8, isSafe: true, weather: "Cerah", windDirection: "SE", temperature: 26 };
const likSiaga = { codes: ["Wn-3"], triggeredAt: 1, alertId: "a", alertEvent: { riskLevel: "siaga", ml: { lik_risk_level: "SIAGA", active_warning: ["Wn-3"] }, decision: { shouldDistribute: true, final_risk_level: "SIAGA" } } };

describe("Peta status = Beranda rule", () => {
	test("nothing: AMAN", async () => {
		Object.assign(state, { active: null, nowcast: [], forecast: calm });
		expect((await M.beachStatus("pantai_lampuuk")).level).toBe("NORMAL");
	});
	test("fishermen's warning alone shows on the map (not only BMKG)", async () => {
		Object.assign(state, { active: likSiaga, nowcast: [], forecast: calm });
		const s = await M.beachStatus("pantai_lampuuk");
		expect(s.level).toBe("SIAGA");
		expect(s.lik?.codes).toEqual(["Wn-3"]);
		expect(s.bmkg.level).toBe("NORMAL");
	});
	test("BMKG warning alone: SIAGA from BMKG", async () => {
		Object.assign(state, { active: null, nowcast: [{ event: "Hujan Lebat dan Petir", expires: 9 }], forecast: calm });
		const s = await M.beachStatus("pantai_lampuuk");
		expect(s.level).toBe("SIAGA");
		expect(s.lik).toBeNull();
		expect(s.bmkg.warnings[0]!.event).toBe("Hujan Lebat dan Petir");
	});
	test("both at SIAGA: BAHAYA", async () => {
		Object.assign(state, { active: likSiaga, nowcast: [{ event: "Hujan Lebat dan Petir", expires: 9 }], forecast: calm });
		expect((await M.beachStatus("pantai_lampuuk")).level).toBe("EKSTREM");
	});
	test("a bad forecast alone: WASPADA", async () => {
		Object.assign(state, { active: null, nowcast: [], forecast: { ...calm, windSpeed: 35 } });
		expect((await M.beachStatus("pantai_lampuuk")).level).toBe("WASPADA");
	});
	test("BMKG has ended: back to the fishermen's own level, not the level fused at report time (UAT G-11)", async () => {
		const likWaspadaFused = { codes: ["Wn-5"], triggeredAt: 1, alertId: "b", alertEvent: { riskLevel: "WASPADA", ml: { lik_risk_level: "WASPADA", active_warning: ["Wn-5"] }, decision: { shouldDistribute: true, final_risk_level: "SIAGA" } } };
		Object.assign(state, { active: likWaspadaFused, nowcast: [], forecast: calm });
		expect((await M.beachStatus("pantai_lampuuk")).level).toBe("WASPADA");
	});
});
