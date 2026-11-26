import { describe, expect, test } from "bun:test";
import { fieldStartMs, sinceFieldStart } from "./field-start";

describe("FIELD_START_AT", () => {
	test("empty or invalid: everything counts", () => {
		expect(fieldStartMs("")).toBe(0);
		expect(fieldStartMs(undefined)).toBe(0);
		expect(fieldStartMs("besok")).toBe(0);
		expect(sinceFieldStart([{ at: 1 }, { at: 2 }], 0)).toHaveLength(2);
	});
	test("4 Dec 00.00 WIB: the practice on 3 Dec is left out", () => {
		const start = fieldStartMs("2026-12-04T00:00:00+07:00");
		expect(start).toBe(Date.parse("2026-12-03T17:00:00Z"));
		const rows = [{ at: Date.parse("2026-12-03T10:00:00+07:00") }, { at: start }, { at: Date.parse("2026-12-05T08:00:00+07:00") }];
		expect(sinceFieldStart(rows, start)).toHaveLength(2);
	});
});
