import { describe, expect, test } from "bun:test";
import { correctSignWord, matchSignCodes, parseLaporCommand } from "./whatsapp-commands";

describe("typos and short forms (15 Nov: '!lapor awn gumpl' was not understood)", () => {
	test.each([
		["awn gumpl", ["Wn-2"]],
		["awan gmpl", ["Wn-2"]],
		["awn bergumpl", ["Wn-2"]],
		["awan numpuk", ["Wn-2"]],
		["awn trun", ["Wn-1"]],
		["awan rendah", ["Wn-1"]],
		["ada kilt", ["Wn-3"]],
		["ptir di laut", ["Wn-3"]],
		["guntur", ["Wn-3"]],
		["lngit mndung", ["Wn-8"]],
		["langit item", ["Wn-9"]],
		["awan hitam", ["Wn-9"]],
		["ujan deres", ["Wn-9"]],
		["gerimis", ["Wn-9"]],
		["ombk gede", ["Wn-4"]],
		["gelombng tinggi", ["Wn-4"]],
		["lumba2 dket prahu", ["Wn-5"]],
		["dolfin", ["Wn-5"]],
		["cmar ribut", ["Wn-6"]],
		["burung laut ribut", ["Wn-6"]],
		["bntang ilang", ["Wn-13"]],
		["bintang gak keliatan", ["Wn-13"]],
		["peralihn angin", ["Wn-7"]],
	])("%s -> %p", (text, codes) => {
		expect(matchSignCodes(text)).toEqual(codes);
	});

	test("ordinary words are not turned into signs", () => {
		for (const t of ["pantai aman", "saya di laut", "lapor kejadian", "sudah sampai", "kapal bocor"]) {
			expect(matchSignCodes(t)).toEqual([]);
		}
		expect(correctSignWord("aman")).toBeNull();
		expect(correctSignWord("lampuuk")).toBeNull();
	});

	test("the screenshot message in a beach group", () => {
		expect(parseLaporCommand("!lapor awn gumpl lampuuk")).toEqual({ ok: true, beachLocation: "pantai_lampuuk", likCodes: ["Wn-2"] });
	});
});
