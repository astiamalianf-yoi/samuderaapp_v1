import { describe, expect, test } from "bun:test";
import { matchSignCodes, parseLaporCommand, signLabel } from "./whatsapp-commands";

// Expected codes follow the codebook (frontend/src/constants/signs.ts).
describe("WhatsApp phrases from the pilot group export", () => {
	const cases: [string, string[]][] = [
		["!lapor ombak besar di Lampuuk", ["Wn-4"]],
		["!lapor ombak tinggi di lampuuk", ["Wn-4"]],
		["!lapor terlihat awan tebal bergumpal tebal di pantai depok", ["Wn-2"]],
		["!lapor terlihat awan bergerak turun dan saling mendekat di pantai depok", ["Wn-1", "Wn-2"]],
		["!lapor saya lihat awan bergerombol dan bergerak turun di pantai depok", ["Wn-1"]],
		["!lapor ada awan tebal di pantai depok", ["Wn-9"]],
		["!lapor awan gelap tebal nih di pantai depok", ["Wn-9"]],
		["!lapor monitor awn gelap di pantai depok", ["Wn-9"]],
		["!lapor monitor di pntai depok awn glp", ["Wn-9"]],
		["aku mau lapor cuaca di pantai samas awan turun bergerombol", ["Wn-1"]],
		["mau lapor cuaca di pantai samas cerah", ["Wn-10"]],
	];
	for (const [text, codes] of cases) {
		test(text, () => expect(matchSignCodes(text).sort()).toEqual([...codes].sort()));
	}
});

describe("codebook signs", () => {
	const cases: [string, string[]][] = [
		["awan turun", ["Wn-1"]],
		["awan turun membentuk gumpalan", ["Wn-1"]],
		["awan bergumpal saling mendekat", ["Wn-2"]],
		["ada kilat di sisi langit", ["Wn-3"]],
		["ada petir", ["Wn-3"]],
		["gelombang berubah besar dan rapat", ["Wn-4"]],
		["lumba-lumba mendekati perahu", ["Wn-5"]],
		["burung camar terbang tergesa", ["Wn-6"]],
		["peralihan angin barat ke angin timur", ["Wn-7"]],
		["angin barat ke timur", ["Wn-7"]],
		["langit mendung", ["Wn-8"]],
		["hujan deras", ["Wn-9"]],
		["cerah tanpa awan", ["Wn-10"]],
		["suara dentuman 7 kali", ["Wn-11"]],
		["banyak bintang berkelap kelip", ["Wn-12"]],
		["bintang tidak terlihat", ["Wn-13"]],
		["bintang redup", ["Wn-13"]],
		["gak ada bintang", ["Wn-13"]],
		["bintang sejajar dengan bulan", ["Wn-14"]],
		["kecoak beterbangan di kapal", ["Wn-15"]],
		["bulan di antara bintang kalajengking", ["Wn-16"]],
		["paus muncul kibas ekor", ["Wn-17"]],
	];
	for (const [text, codes] of cases) {
		test(text, () => expect(matchSignCodes(text).sort()).toEqual([...codes].sort()));
	}
});

describe("words that are not a codebook sign are not mapped", () => {
	for (const text of ["angin kencang", "air laut naik", "pasang tinggi", "puting beliung", "cuaca buruk", "ikan naik", "langit merah"]) {
		test(text, () => expect(matchSignCodes(text)).toEqual([]));
	}
	test("the bot asks which sign when none is recognised", () => {
		expect(parseLaporCommand("!lapor angin kencang di pantai depok")).toEqual({ ok: false, missing: "signs" });
	});
});

describe("labels", () => {
	test("codebook names, not the old wrong ones", () => {
		expect(signLabel("Wn-8")).toBe("Langit mendung");
		expect(signLabel("Wn-9")).toBe("Hujan, awan tebal");
		expect(signLabel("Wn-13")).toBe("Bintang hilang");
	});
	test("full command still finds the beach", () => {
		expect(parseLaporCommand("!lapor ombak besar di pantai samas")).toEqual({
			ok: true,
			beachLocation: "pantai_samas",
			likCodes: ["Wn-4"],
		});
	});
});
