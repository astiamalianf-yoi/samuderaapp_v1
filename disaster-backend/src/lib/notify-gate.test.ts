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
