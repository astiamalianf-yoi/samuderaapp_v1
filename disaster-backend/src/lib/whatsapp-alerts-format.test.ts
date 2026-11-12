import { describe, expect, test } from "bun:test";
import { formatAlertsResponse } from "./whatsapp-commands";

const now = Date.UTC(2026, 10, 12, 16, 10); // 23.10 WIB
const bmkg = (ts: number) => ({
	alertId: "bmkg-abc", source: "BMKG", beachLocation: "pantai_lampuuk", riskLevel: "siaga",
	reporterCount: 0, firstReportAt: 0, lastReportAt: 0, triggeredCodes: [], serverTimestamp: ts,
	actionRecommendation: "Peringatan BMKG: Hujan Lebat dan Petir sampai 00.15 WIB. Tunda melaut sampai peringatan berakhir.",
	signDescription: "Hujan Lebat dan Petir",
	bmkg: { event: "Hujan Lebat dan Petir", expires: Date.UTC(2026, 10, 12, 17, 15) },
});

describe("!peringatan reply", () => {
	test("a BMKG warning is shown as BMKG, once, with its end time and no fishermen lines", () => {
		const text = formatAlertsResponse([bmkg(now - 60_000), bmkg(now - 3_600_000)], "pantai_lampuuk", now);
		expect(text).toContain("PERINGATAN BMKG");
		expect(text).toContain("Berlaku sampai 00.15 WIB");
		expect(text).not.toContain("Dilaporkan oleh 0");
		expect(text).not.toContain("07.00");
		expect(text).not.toContain("Tanda Alam");
		expect(text.split("PERINGATAN BMKG").length - 1).toBe(1);
	});

	test("an expired BMKG warning is not shown", () => {
		const text = formatAlertsResponse([bmkg(now - 60_000)], "pantai_lampuuk", Date.UTC(2026, 10, 12, 18, 0));
		expect(text).toContain("Kondisi Aman di");
	});

	test("a fishermen's warning keeps reporters, times and signs", () => {
		const text = formatAlertsResponse([{
			alertId: "a1", beachLocation: "pantai_lampuuk", riskLevel: "siaga", reporterCount: 3,
			firstReportAt: now - 600_000, lastReportAt: now - 60_000, triggeredCodes: ["Wn-3"], serverTimestamp: now,
			actionRecommendation: "Tunda melaut",
		}], "pantai_lampuuk", now);
		expect(text).toContain("Dilaporkan oleh 3 nelayan");
		expect(text).toContain("Mulai:");
		expect(text).toContain("Tanda Alam Terdeteksi:");
	});
});
