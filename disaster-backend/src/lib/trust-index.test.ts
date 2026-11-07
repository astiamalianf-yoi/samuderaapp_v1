import { describe, expect, test } from "bun:test";
import { buildAppRecords, computeTrustIndex, PAPER_HIGH, PAPER_LOW, type AppRecord } from "./trust-index";

const H = 3600_000;
const T0 = Date.parse("2026-11-01T00:00:00Z");

describe("Trust Index (Paper 2, Eq. 2-3)", () => {
	test("with no app data it is exactly Table 2", () => {
		const r = computeTrustIndex([]);
		const ti = Object.fromEntries(r.signs.map((s) => [s.code, s.trustIndex]));
		expect(ti["Wn-3"]).toBeCloseTo(55.08, 1);
		expect(ti["Wn-8"]).toBeCloseTo(50.22, 1);
		expect(ti["Wn-7"]).toBeCloseTo(46.13, 1);
		expect(ti["Wn-13"]).toBeCloseTo(33.93, 1);
		expect(ti["Wn-5"]).toBeCloseTo(4.84, 1);
		expect(r.high).toEqual(PAPER_HIGH);
		expect(r.low).toEqual(PAPER_LOW);
		expect(r.signs.filter((s) => s.tier === "Unranked").map((s) => s.code).sort()).toEqual(
			["Wn-10", "Wn-11", "Wn-12", "Wn-14", "Wn-15", "Wn-16", "Wn-17"].sort(),
		);
	});

	test("paper mode ignores app records", () => {
		const recs: AppRecord[] = Array.from({ length: 30 }, () => ({ sign: "Wn-10", predictions: 2, confirmed: 2 }));
		expect(computeTrustIndex(recs, "paper").high).toEqual(PAPER_HIGH);
	});

	test("an unranked sign enters the ranking at 20 records", () => {
		const three: AppRecord[] = Array.from({ length: 3 }, () => ({ sign: "Wn-10", predictions: 1, confirmed: 1 }));
		const r = computeTrustIndex(three);
		const w10 = r.signs.find((s) => s.code === "Wn-10")!;
		expect(w10.records).toBe(20);
		expect(w10.ranked).toBe(true);
		expect(w10.tier).not.toBe("Unranked");
	});

	test("sign reports never followed by strong wind lower the accuracy and can move the sign down", () => {
		const misses: AppRecord[] = Array.from({ length: 40 }, () => ({ sign: "Wn-7", predictions: 3, confirmed: 0 }));
		const r = computeTrustIndex(misses);
		const w7 = r.signs.find((s) => s.code === "Wn-7")!;
		expect(w7.accuracy).toBeLessThan(60);
		expect(w7.tier).toBe("Low");
		expect(r.high).not.toContain("Wn-7");
	});
});

describe("app records", () => {
	const rep = (fishermanId: string, at: number, signs = ["WN-3"], beach = "pantai_lampuuk") => ({ fishermanId, beach, signs, at });
	const inc = (fishermanId: string, at: number, type = "angin_kencang", beach = "pantai_lampuuk") => ({ fishermanId, beach, type, at });
	const now = T0 + 100 * H;

	test("a report is confirmed by a strong-wind incident from another fisherman within 24 h", () => {
		const recs = buildAppRecords([rep("a", T0)], [inc("b", T0 + 5 * H)], now);
		expect(recs).toEqual([{ sign: "Wn-3", predictions: 1, confirmed: 1 }]);
	});

	test("his own incident, another beach, a late or non-wind incident do not confirm", () => {
		const events = [inc("a", T0 + H), inc("b", T0 + H, "angin_kencang", "pantai_lhoknga"), inc("b", T0 + 30 * H), inc("b", T0 + H, "arus_kuat")];
		expect(buildAppRecords([rep("a", T0)], events, now)).toEqual([{ sign: "Wn-3", predictions: 1, confirmed: 0 }]);
	});

	test("repeats within 5 minutes are one prediction; reports still in their window wait", () => {
		const reports = [rep("a", T0), rep("a", T0 + 60_000), rep("a", T0 + 10 * H), rep("a", now - H)];
		expect(buildAppRecords(reports, [], now)).toEqual([{ sign: "Wn-3", predictions: 2, confirmed: 0 }]);
	});

	test("one record per fisherman, sign and month", () => {
		const nextMonth = Date.parse("2026-12-03T00:00:00Z");
		const recs = buildAppRecords([rep("a", T0), rep("a", nextMonth), rep("b", T0)], [], nextMonth + 50 * H);
		expect(recs.length).toBe(3);
	});
});
