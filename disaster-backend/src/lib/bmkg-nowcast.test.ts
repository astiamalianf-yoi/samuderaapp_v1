import { describe, expect, test } from "bun:test";
import {
	buildNowcastAlertEvent,
	capAppliesToBeach,
	formatNowcastWhatsApp,
	parseCap,
	parseRssItems,
} from "./bmkg-nowcast";

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Peringatan Dini Cuaca Aceh</title><link>https://www.bmkg.go.id/alerts/nowcast/id/CBT20261106001_alert.xml</link><pubDate>Fri, 06 Nov 2026 09:40:00 +0000</pubDate></item>
<item><title>Peringatan Dini Cuaca Jawa Timur</title><link>https://www.bmkg.go.id/alerts/nowcast/id/x.xml</link></item>
</channel></rss>`;

const capXml = (description: string, polygon = "") => `<?xml version="1.0"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
<identifier>CBT20261106001</identifier>
<info><language>id</language><event>Hujan Lebat dan Petir</event>
<effective>2026-11-06T16:45:00+07:00</effective><expires>2026-11-06T20:06:00+07:00</expires>
<headline>Peringatan Dini Cuaca Aceh</headline>
<description>${description}</description>
<area><areaDesc>Aceh</areaDesc>${polygon ? `<polygon>${polygon}</polygon>` : ""}</area></info></alert>`;

const WEST_ACEH = "Hujan lebat disertai petir akan terjadi di sebagian wilayah Aceh, khususnya di ARONGAN LAMBALEK, BUBON, DANAU PARIS, DARUL HIKMAH, DARUL MAKMUR, GEUMPANG, GUNUNG MERIAH";

describe("BMKG nowcast parsing", () => {
	test("reads RSS items", () => {
		const items = parseRssItems(RSS);
		expect(items).toHaveLength(2);
		expect(items[0]!.title).toBe("Peringatan Dini Cuaca Aceh");
	});

	test("reads the CAP info", () => {
		const cap = parseCap(capXml(WEST_ACEH))!;
		expect(cap.id).toBe("CBT20261106001");
		expect(cap.event).toBe("Hujan Lebat dan Petir");
		expect(cap.expires).toBe(Date.parse("2026-11-06T20:06:00+07:00"));
	});
});

describe("capAppliesToBeach", () => {
	test("a warning for West Aceh districts does not cover Lampuuk", () => {
		expect(capAppliesToBeach("pantai_lampuuk", parseCap(capXml(WEST_ACEH))!)).toBe(false);
	});
	test("naming the kecamatan or kabupaten covers the beach", () => {
		expect(capAppliesToBeach("pantai_lampuuk", parseCap(capXml(`${WEST_ACEH}, LHOKNGA`))!)).toBe(true);
		expect(capAppliesToBeach("pantai_ulee_lheue", parseCap(capXml("Kota Banda Aceh"))!)).toBe(true);
		expect(capAppliesToBeach("pantai_ulee_lheue", parseCap(capXml("Kab. Aceh Besar"))!)).toBe(false);
	});
	test("a polygon around the beach covers it", () => {
		const cap = parseCap(capXml("tanpa nama wilayah", "-8.1,110.2 -8.1,110.4 -7.9,110.4 -7.9,110.2 -8.1,110.2"))!;
		expect(capAppliesToBeach("pantai_depok", cap)).toBe(true);
		expect(capAppliesToBeach("pantai_lampuuk", cap)).toBe(false);
	});
});

describe("broadcast content", () => {
	const w = parseCap(capXml(`${WEST_ACEH}, LHOKNGA`))!;
	test("alert event is SIAGA and marked as BMKG", () => {
		const ev = buildNowcastAlertEvent(w, "pantai_lampuuk", 0);
		expect(ev.source).toBe("BMKG");
		expect(ev.riskLevel).toBe("siaga");
		expect(ev.decision.final_risk_level).toBe("SIAGA");
		expect(ev.ml.action_recommendation).toContain("Tunda melaut");
		expect(buildNowcastAlertEvent(w, "pantai_lhoknga", 0).alertId).not.toBe(ev.alertId);
	});
	test("one WhatsApp message lists every covered beach", () => {
		const text = formatNowcastWhatsApp(w, ["pantai_lampuuk", "pantai_lhoknga"]);
		expect(text).toContain("Pantai Lampuuk, Pantai Lhoknga");
		expect(text).toContain("20.06 WIB");
		expect(text).toContain("Tunda melaut");
	});
});
