import { describe, expect, test } from "bun:test";
import { parseLaporCommand } from "./whatsapp-commands";
import { capAppliesToBeach } from "./bmkg-nowcast";
import { ALLOWED_BEACH_LOCATIONS } from "../types";

const cap = (description: string, headline = "") => ({ polygons: [], areaDescs: [], description, headline });

describe("West Java beaches", () => {
	test("are allowed beaches", () => {
		for (const b of ["pantai_pangandaran", "pantai_batu_karas", "pantai_bojongsalawe"]) {
			expect(ALLOWED_BEACH_LOCATIONS).toContain(b as never);
		}
	});

	test("WhatsApp: the specific beach wins over the regency name", () => {
		expect(parseLaporCommand("!lapor ombak besar di batu karas pangandaran")).toMatchObject({ ok: true, beachLocation: "pantai_batu_karas" });
		expect(parseLaporCommand("!lapor ombak besar di batukaras")).toMatchObject({ beachLocation: "pantai_batu_karas" });
		expect(parseLaporCommand("!lapor ada kilat di bojong salawe")).toMatchObject({ beachLocation: "pantai_bojongsalawe", likCodes: ["Wn-3"] });
		expect(parseLaporCommand("!lapor ombak besar di pantai pangandaran")).toMatchObject({ beachLocation: "pantai_pangandaran" });
	});

	test("BMKG: a West Java warning naming Parigi covers Bojongsalawe", () => {
		const w = cap("Hujan lebat akan terjadi di sebagian wilayah Jawa Barat, khususnya di CIJULANG, PARIGI, SIDAMULIH.");
		expect(capAppliesToBeach("pantai_bojongsalawe", w)).toBe(true);
		expect(capAppliesToBeach("pantai_batu_karas", w)).toBe(true);
		expect(capAppliesToBeach("pantai_pangandaran", w)).toBe(false);
	});

	test("BMKG: 'Parigi' in Central Sulawesi does not cover Bojongsalawe", () => {
		const w = cap("Hujan lebat akan terjadi di sebagian wilayah Sulawesi Tengah, khususnya di PARIGI, PARIGI SELATAN.");
		expect(capAppliesToBeach("pantai_bojongsalawe", w)).toBe(false);
	});
});
