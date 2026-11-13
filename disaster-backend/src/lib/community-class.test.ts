import { describe, expect, test } from "bun:test";
import { majorityClasses } from "./community-class";

const row = (p3: number | null, p5?: number) => ({ "Wn-3": p3, ...(p5 === undefined ? {} : { "Wn-5": p5 }) });

describe("majorityClasses (WhatsApp group class)", () => {
	test("too few registered fishermen: survey profile (null)", () => {
		expect(majorityClasses(Array.from({ length: 9 }, () => row(0.2)), 10, 0.6)).toBeNull();
	});

	test("more than half Inaction -> Inaction for that sign", () => {
		const rows = [...Array.from({ length: 6 }, () => row(0.3, 0.9)), ...Array.from({ length: 4 }, () => row(0.8, 0.9))];
		const r = majorityClasses(rows, 10, 0.6)!;
		expect(r.classes["Wn-3"]).toBe(0);
		expect(r.classes["Wn-5"]).toBe(1);
		expect(r.inactionShare["Wn-3"]).toBe(0.6);
		expect(r.registered).toBe(10);
	});

	test("exactly half Inaction is not a majority -> Actionable", () => {
		const rows = [...Array.from({ length: 5 }, () => row(0.3)), ...Array.from({ length: 5 }, () => row(0.7))];
		expect(majorityClasses(rows, 10, 0.6)!.classes["Wn-3"]).toBe(1);
	});

	test("threshold τ: P = 0.60 counts as Actionable", () => {
		expect(majorityClasses(Array.from({ length: 10 }, () => row(0.6)), 10, 0.6)!.classes["Wn-3"]).toBe(1);
	});

	test("signs without a probability (no local model) are left to the survey profile", () => {
		const rows = Array.from({ length: 12 }, () => row(null, 0.2));
		const r = majorityClasses(rows, 10, 0.6)!;
		expect(r.classes["Wn-3"]).toBeUndefined();
		expect(r.classes["Wn-5"]).toBe(0);
	});
});
