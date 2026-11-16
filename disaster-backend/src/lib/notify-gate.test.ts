import { describe, expect, test } from "bun:test";
import { notifyDecision } from "./notify-gate";

const active = (codes: string[], level: string, distributed = true) => ({
	codes, triggeredAt: 1, alertId: "a",
	alertEvent: { riskLevel: level.toLowerCase(), decision: { final_risk_level: level, shouldDistribute: distributed } },
});

describe("repeat reports during an active warning (option 1, 14 Nov)", () => {
	test("no active warning: notify", () => {
		expect(notifyDecision(null, ["Wn-3"], "SIAGA")).toMatchObject({ notify: true, reason: "first" });
	});
	test("another person, same sign, same level: quiet update", () => {
		expect(notifyDecision(active(["Wn-3"], "EKSTREM"), ["Wn-3"], "EKSTREM")).toMatchObject({ notify: false, reason: "no_change" });
	});
	test("a sign not yet in the warning: notify", () => {
		expect(notifyDecision(active(["Wn-3"], "EKSTREM"), ["Wn-1"], "EKSTREM")).toMatchObject({ notify: true, reason: "new_sign", newCodes: ["Wn-1"] });
	});
	test("same sign but the level rose (e.g. BMKG warning came in): notify", () => {
		expect(notifyDecision(active(["Wn-5"], "WASPADA"), ["Wn-5"], "SIAGA")).toMatchObject({ notify: true, reason: "level_up" });
		expect(notifyDecision(active(["Wn-3"], "SIAGA"), ["Wn-3"], "EKSTREM")).toMatchObject({ notify: true, reason: "level_up" });
	});
	test("same sign, lower level: quiet", () => {
		expect(notifyDecision(active(["Wn-3"], "EKSTREM"), ["Wn-3"], "SIAGA").notify).toBe(false);
	});
	test("the earlier warning was never sent (NORMAL): notify when it now matters", () => {
		expect(notifyDecision(active(["Wn-5"], "NORMAL", false), ["Wn-5"], "WASPADA")).toMatchObject({ notify: true, reason: "level_up" });
	});
});

import { claimNotify, notifySignature } from "./notify-gate";
describe("claimNotify (simultaneous reports)", () => {
	test("only the first of many simultaneous claims notifies", async () => {
		const keys = new Set<string>();
		const store = { set: async (k: string) => (keys.has(k) ? null : (keys.add(k), "OK")) };
		const results = await Promise.all(Array.from({ length: 20 }, () => claimNotify(store, "pantai_samas", ["Wn-5"], "WASPADA")));
		expect(results.filter(Boolean).length).toBe(1);
	});
	test("a new sign or a higher level is a new signature", () => {
		expect(notifySignature("b", ["Wn-5"], "WASPADA")).not.toBe(notifySignature("b", ["Wn-5", "Wn-3"], "WASPADA"));
		expect(notifySignature("b", ["Wn-5"], "WASPADA")).not.toBe(notifySignature("b", ["Wn-5"], "SIAGA"));
		expect(notifySignature("b", ["Wn-3", "Wn-5"], "siaga")).toBe(notifySignature("b", ["Wn-5", "Wn-3"], "SIAGA"));
	});
});
