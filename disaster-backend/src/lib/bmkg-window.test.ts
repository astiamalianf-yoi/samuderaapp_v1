import { describe, expect, it } from "bun:test";
import { unsafeWindow, type BmkgCuacaItem } from "./bmkg-fetch";

const slot = (iso: string, ws: number, weather = 1) => ({ datetime: iso, ws, weather }) as unknown as BmkgCuacaItem;
const wib = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });

describe("BMKG forecast window (matrix row 2: Prakiraan 08.00–15.00 WIB)", () => {
	it("runs from the current slot to the end of the last consecutive unsafe slot", () => {
		const w = unsafeWindow([slot("2026-11-23T01:00:00Z", 35), slot("2026-11-23T04:00:00Z", 32), slot("2026-11-23T07:00:00Z", 30), slot("2026-11-23T10:00:00Z", 12)]);
		expect(w && [wib(w.start), wib(w.end)]).toEqual(["08.00", "17.00"]);
	});
	it("bad weather alone counts; the last slot ends 3 hours later", () => {
		const w = unsafeWindow([slot("2026-11-23T01:00:00Z", 10, 63), slot("2026-11-23T04:00:00Z", 35)]);
		expect(w && [wib(w.start), wib(w.end)]).toEqual(["08.00", "14.00"]);
	});
	it("no window when the current slot is safe", () => {
		expect(unsafeWindow([slot("2026-11-23T01:00:00Z", 10), slot("2026-11-23T04:00:00Z", 40)])).toBeNull();
	});
});
