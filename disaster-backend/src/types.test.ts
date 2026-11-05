import { describe, expect, test } from "bun:test";
import { likRiskLevel, type MlResult } from "./types";

const base: MlResult = {
	active_warning: [],
	sign_description: "",
	community_characteristics: "Actionable",
	action_recommendation: "",
};

describe("likRiskLevel", () => {
	test("uses the strategy-based level from the model service", () => {
		expect(likRiskLevel({ ...base, lik_risk_level: "WASPADA" }, true)).toBe("WASPADA");
		expect(likRiskLevel({ ...base, lik_risk_level: "SIAGA" }, false)).toBe("SIAGA");
	});

	test("falls back to the legacy mapping for older responses", () => {
		expect(likRiskLevel(base, true)).toBe("SIAGA");
		expect(likRiskLevel(base, false)).toBe("WASPADA");
		expect(likRiskLevel({ ...base, community_characteristics: "Low Actionable" }, false)).toBe("NORMAL");
	});
});
