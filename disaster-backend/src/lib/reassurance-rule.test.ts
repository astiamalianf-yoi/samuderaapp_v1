import { describe, expect, test } from "bun:test";
import { determineBmkgRisk, fuseLevels, fusionDecision } from "./reassurance";

const calm = { windSpeed: 5, isSafe: true };

describe("determineBmkgRisk", () => {
	test("an official BMKG warning is HIGH even in calm weather", () => {
		expect(determineBmkgRisk(calm, true)).toBe("HIGH");
		expect(determineBmkgRisk(null, true)).toBe("HIGH");
	});
	test("strong wind is HIGH", () => {
		expect(determineBmkgRisk({ windSpeed: 46, isSafe: false }, false)).toBe("HIGH");
	});
	test("a bad-weather forecast alone is only MEDIUM", () => {
		expect(determineBmkgRisk({ windSpeed: 5, isSafe: false }, false)).toBe("MEDIUM");
		expect(determineBmkgRisk({ windSpeed: 30, isSafe: true }, false)).toBe("MEDIUM");
	});
	test("calm weather without a warning is LOW; no data is UNKNOWN", () => {
		expect(determineBmkgRisk(calm, false)).toBe("LOW");
		expect(determineBmkgRisk(null, false)).toBe("UNKNOWN");
	});
});

describe("fusion of LIK and BMKG", () => {
	test("the higher of the two sources is used", () => {
		expect(fusionDecision("WASPADA", "LOW").finalLevel).toBe("WASPADA");
		expect(fusionDecision("NORMAL", "HIGH").finalLevel).toBe("SIAGA");
		expect(fusionDecision("SIAGA", "MEDIUM").finalLevel).toBe("SIAGA");
		expect(fusionDecision("WASPADA", "MEDIUM").finalLevel).toBe("WASPADA");
	});
	test("both sources at SIAGA raise the warning to BAHAYA (EKSTREM)", () => {
		const r = fusionDecision("SIAGA", "HIGH");
		expect(r.finalLevel).toBe("EKSTREM");
		expect(r.finalLevelNumeric).toBe(3);
		expect(r.agreed).toBe(true);
	});
	test("BAHAYA needs both sides; one side alone never reaches it", () => {
		for (const [l, b] of [[0, 2], [1, 2], [2, 0], [2, 1]] as const) expect(fuseLevels(l, b)).toBeLessThan(3);
		expect(fuseLevels(2, 2)).toBe(3);
	});
});
