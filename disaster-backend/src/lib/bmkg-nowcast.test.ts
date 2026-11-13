import { describe, expect, test } from "bun:test";
import {
	buildNowcastAlertEvent,
	capAppliesToBeach,
	formatNowcastWhatsApp,
	nowcastNews,
	shortNowcastDescription,
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
	test("with an active fishermen's warning at SIAGA, the BMKG event is BAHAYA (EKSTREM)", () => {
		const ev = buildNowcastAlertEvent(w, "pantai_lampuuk", 0, "SIAGA");
		expect(ev.riskLevel).toBe("ekstrem");
		expect(ev.decision.final_risk_level).toBe("EKSTREM");
		expect(ev.ml.action_recommendation).toContain("Jangan melaut");
		expect(buildNowcastAlertEvent(w, "pantai_lampuuk", 0, "WASPADA").riskLevel).toBe("siaga");
	});
	test("the WhatsApp message says BAHAYA only for the beaches where fishermen also reported", () => {
		const one = formatNowcastWhatsApp(w, ["pantai_lampuuk", "pantai_lhoknga"], ["pantai_lampuuk"]);
		expect(one).toContain("PERINGATAN BMKG — SIAGA");
		expect(one).toContain("BAHAYA* di Pantai Lampuuk");
		const all = formatNowcastWhatsApp(w, ["pantai_lampuuk"], ["pantai_lampuuk"]);
		expect(all).toContain("PERINGATAN BMKG — BAHAYA");
		expect(all).toContain("Jangan melaut");
	});
	test("one WhatsApp message lists every covered beach", () => {
		const text = formatNowcastWhatsApp(w, ["pantai_lampuuk", "pantai_lhoknga"]);
		expect(text).toContain("Pantai Lampuuk, Pantai Lhoknga");
		expect(text).toContain("20.06 WIB");
		expect(text).toContain("Tunda melaut");
	});
});

describe("BMKG re-issues are not broadcast again", () => {
	const now = Date.UTC(2026, 10, 12, 17, 38); // 00.38 WIB
	const h = 3600_000;
	const last = { event: "Hujan Lebat dan Petir", expires: now + 3 * h, level: "SIAGA" };

	test("the first warning for a beach is news", () => {
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 3 * h }, "SIAGA", null, now)).toBe("new");
	});
	test("a re-issue with the same event and end time is not sent again", () => {
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 3 * h }, "SIAGA", last, now + h)).toBeNull();
	});
	test("a later end time is sent as an extension", () => {
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 5 * h }, "SIAGA", last, now + h)).toBe("extended");
	});
	test("BAHAYA (fishermen also report) is sent", () => {
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 3 * h }, "EKSTREM", last, now + h)).toBe("escalated");
	});
	test("another event, or after the earlier warning ended, is new", () => {
		expect(nowcastNews({ event: "Angin Kencang", expires: now + 3 * h }, "SIAGA", last, now + h)).toBe("new");
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 6 * h }, "SIAGA", last, now + 4 * h)).toBe("new");
	});
	test("a warning ending within 15 minutes is not sent", () => {
		expect(nowcastNews({ event: "Hujan Lebat dan Petir", expires: now + 7 * 60_000 }, "SIAGA", null, now)).toBeNull();
	});
});

describe("BMKG text in WhatsApp", () => {
	const long = "Hujan lebat disertai petir akan terjadi pada 13 November 2026, 00:20 WIB di sebagian wilayah Aceh, khususnya di BABUL MAKMUR, BABUL RAHMAH, BABUSSALAM, BADAR, BAKONGAN, LHOKNGA, MEURAXA";
	test("drops the kecamatan list and names the beach's own area", () => {
		const text = shortNowcastDescription(long, ["pantai_lhoknga"]);
		expect(text).toBe("Hujan lebat disertai petir akan terjadi pada 13 November 2026, 00:20 WIB di sebagian wilayah Aceh, termasuk Aceh Besar.");
		expect(text).not.toContain("BABUL");
	});
	test("an extension says so", () => {
		const w = { id: "x", event: "Hujan Lebat dan Petir", headline: "", description: long, effective: null, expires: Date.UTC(2026, 10, 12, 21, 0) };
		expect(formatNowcastWhatsApp(w, ["pantai_lampuuk"], [], true)).toContain("Diperpanjang* sampai 04.00 WIB");
	});
});
