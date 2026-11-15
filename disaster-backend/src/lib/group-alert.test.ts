import { describe, expect, test } from "bun:test";
import { formatGroupAlert } from "./group-alert";

const t = (h: number, m: number) => Date.UTC(2026, 10, 15, h - 7, m);

describe("group message mirrors the app card for the beach (15 Nov, Lhoknga)", () => {
	test("Hujan/awan tebal (Enhanced, WASPADA) under a BMKG warning: SIAGA with the BMKG reason", () => {
		const msg = formatGroupAlert({ beachLocation: "pantai_lhoknga", codes: ["Wn-9"], likLevel: "WASPADA", finalLevel: "SIAGA",
			strategyCode: "ENHANCED_MONITORING", bmkgLevel: "SIAGA", bmkgWarnings: [{ event: "Hujan Lebat dan Petir", expires: t(16, 15) }],
			reporterCount: 1, startedAt: t(13, 57), endsAt: t(16, 15) });
		expect(msg).toContain("PERINGATAN DARI NELAYAN DAN BMKG · PANTAI LHOKNGA");
		expect(msg).toContain("🟠 *SIAGA* — Bahaya, siapkan perlindungan");
		expect(msg).toContain("*Pantau tanda alam lain*");
		expect(msg).toContain("ℹ️ Level SIAGA karena peringatan BMKG: Hujan Lebat dan Petir sampai 16.15 WIB");
		expect(msg).toContain("🌊 Tanda: Hujan, awan tebal");
		expect(msg).toContain("mulai 13.57 WIB · berlaku sampai 16.15 WIB");
		expect(msg).not.toMatch(/Wn-9|pantai lhoknga|sedang dikirim/);
	});
	test("both SIAGA: BAHAYA box and the BMKG line", () => {
		const msg = formatGroupAlert({ beachLocation: "pantai_lampuuk", codes: ["Wn-3"], likLevel: "SIAGA", finalLevel: "EKSTREM",
			strategyCode: "STANDARD", bmkgLevel: "SIAGA", bmkgWarnings: [{ event: "Hujan Lebat dan Petir", expires: t(20, 54) }],
			reporterCount: 2, startedAt: t(17, 0), endsAt: t(20, 54) });
		expect(msg).toContain("🛑 *BAHAYA* — Jangan melaut");
		expect(msg).toContain("🛑 Nelayan dan BMKG sama-sama memberi peringatan bahaya. Jangan melaut.");
		expect(msg).toContain("⚠️ BMKG juga mengeluarkan peringatan: Hujan Lebat dan Petir sampai 20.54 WIB.");
		expect(msg).not.toContain("ℹ️");
	});
	test("fishermen only: no BMKG words", () => {
		const msg = formatGroupAlert({ beachLocation: "pantai_lampuuk", codes: ["Wn-3", "Wn-5"], likLevel: "SIAGA", finalLevel: "SIAGA",
			strategyCode: "STANDARD", bmkgLevel: "NORMAL", reporterCount: 1, startedAt: t(9, 0), endsAt: t(10, 0) });
		expect(msg).toContain("PERINGATAN DARI NELAYAN · PANTAI LAMPUUK");
		expect(msg).toContain("*Tanda alam terpercaya terlihat*");
		expect(msg).toContain("Tanda: Ada kilat, Lumba-lumba mendekat");
		expect(msg).not.toMatch(/BMKG|ℹ️/);
	});
});
