import { describe, expect, test } from "bun:test";
import { determineBmkgRisk } from "./reassurance";

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
