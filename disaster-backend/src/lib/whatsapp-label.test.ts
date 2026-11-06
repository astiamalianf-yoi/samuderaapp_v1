import { describe, expect, test } from "bun:test";
import { riskLabelFor } from "./whatsapp-commands";

describe("riskLabelFor", () => {
	test("fusion levels map to the right WhatsApp label", () => {
		expect(riskLabelFor("siaga")).toBe("🔴 BAHAYA");
		expect(riskLabelFor("EKSTREM")).toBe("🔴 BAHAYA");
		expect(riskLabelFor("waspada")).toBe("🟡 WASPADA");
		expect(riskLabelFor("normal")).toBe("✅ Aman");
	});
	test("legacy feed levels still map", () => {
		expect(riskLabelFor("unsafe-high")).toBe("🔴 BAHAYA");
		expect(riskLabelFor("unsafe")).toBe("🟡 WASPADA");
	});
	test("a triggered alert is never labelled Aman by mistake", () => {
		for (const l of ["siaga", "waspada", "ekstrem", "unsafe", "unsafe-high"]) {
			expect(riskLabelFor(l)).not.toBe("✅ Aman");
		}
	});
});
