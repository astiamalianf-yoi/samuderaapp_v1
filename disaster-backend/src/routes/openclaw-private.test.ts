import { describe, expect, test } from "bun:test";
import { defaultBeachFor, isGroupChat, PRIVATE_MISSING_BEACH, FROM_GROUP_NOTE } from "./openclaw-webhook";

const registered = (phone?: string) => (phone === "+6281277000011" ? ({ homeBeach: "lhoknga" } as any) : null);

describe("private reports to the bot", () => {
	test("a group id is a group chat, a number is a private chat", () => {
		expect(isGroupChat("120363406080394106@g.us")).toBe(true);
		expect(isGroupChat("+6281277000011")).toBe(false);
		expect(isGroupChat(undefined)).toBe(false);
	});

	test("private chat: the beach comes from his registration", () => {
		expect(defaultBeachFor("+6281277000011", "+6281277000011", registered)).toBe("lhoknga");
	});

	test("private chat, not registered: no beach, so we ask", () => {
		expect(defaultBeachFor("+6281277000099", "+6281277000099", registered)).toBeNull();
		expect(PRIVATE_MISSING_BEACH).toContain("Di pantai mana");
		expect(PRIVATE_MISSING_BEACH).toContain("Daftar");
	});

	test("the group receipt note asks him to report privately next time", () => {
		expect(FROM_GROUP_NOTE).toContain("chat pribadi");
	});
});

import { formatAlertsResponse } from "../lib/whatsapp-commands";
describe("!peringatan end time", () => {
	const base = { source: "LIK", beachLocation: "pantai_lampuuk", riskLevel: "siaga", reporterCount: 2, triggeredCodes: ["Wn-3"], serverTimestamp: Date.UTC(2026, 10, 16, 10, 59), firstReportAt: Date.UTC(2026, 10, 16, 10, 59), lastReportAt: Date.UTC(2026, 10, 16, 10, 59) };
	const now = Date.UTC(2026, 10, 16, 11, 10);
	test("shows 'berlaku sampai' the warning's end, not the last report", () => {
		const t = formatAlertsResponse([{ ...base, alertId: "a", endsAt: Date.UTC(2026, 10, 16, 11, 59) }], "pantai_lampuuk", now);
		expect(t).toContain("Mulai: 17.59 WIB · berlaku sampai 18.59 WIB");
		expect(t).not.toContain("Berakhir");
	});
	test("an ended or merged fishermen's alert is not shown", () => {
		const t = formatAlertsResponse([{ ...base, alertId: "b", endsAt: null }], "pantai_lampuuk", now);
		expect(t).toContain("Kondisi Aman");
	});
});

import { isHelpCommand } from "./openclaw-webhook";
import { formatHelpMessage } from "./incidents";
describe("call for help on WhatsApp", () => {
	test("help commands", () => {
		for (const t of ["!tolong", "!tolong angin kencang", "!bantu", "!sos", "!tlg ombak besar", "!kejadian badai tolong"]) expect(isHelpCommand(t)).toBe(true);
		for (const t of ["!kejadian badai", "!lapor awan hitam", "tolong", "!peringatan"]) expect(isHelpCommand(t)).toBe(false);
	});
	test("message without a hazard type and with the location asked on WhatsApp", () => {
		const m = formatHelpMessage({ beach: "pantai_lampuuk", type: null, phone: "6281277000011", locationStatus: "via_whatsapp" });
		expect(m).toContain("NELAYAN BUTUH BANTUAN");
		expect(m).toContain("jenis belum disebut");
		expect(m).toContain("membagikan lokasinya");
		expect(m).toContain("0812-7700-0011");
	});
});

describe("!peringatan = the current final card (27 Nov 2026)", () => {
	const card = async (b: string) => `*STATUS LAUT HARI INI*\nLokasi: ${b}`;
	test("a named beach gets that beach's card, in a group or in a private chat", async () => {
		const { handlePeringatan } = await import("./openclaw-webhook");
		expect(await handlePeringatan("!peringatan lhoknga", "6280000000099@s.whatsapp.net", undefined, card)).toBe("*STATUS LAUT HARI INI*\nLokasi: pantai_lhoknga");
	});
	test("private, not registered, no beach named: the card of each field beach", async () => {
		const { handlePeringatan, PERINGATAN_ALL_BEACHES } = await import("./openclaw-webhook");
		const t = await handlePeringatan("!peringatan", "6280000000099@s.whatsapp.net", undefined, card);
		for (const b of PERINGATAN_ALL_BEACHES) expect(t).toContain(`Lokasi: ${b}`);
		expect(t.split("---")).toHaveLength(3);
	});
});
