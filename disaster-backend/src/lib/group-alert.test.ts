import { describe, expect, test } from "bun:test";
import { formatGroupAlert } from "./group-alert";
import { buildWarningMessage, formatAllClear, plain, toWhatsAppText, type WarningMessageInput } from "./warning-message";
const noBold = (s: string) => s.replace(/\*/g, "");

// Warning Strategy Matrix, table 3, rows 1–15 (agreed 23 Nov 2026). Example: Pantai Lampuuk, one
// report at 08.00 WIB, LIK warning until 09.00, official BMKG "Angin Kencang" until 15.00.
const t = (h: number, m: number) => Date.UTC(2026, 11, 4, h - 7, m);
const NOW = t(8, 5);
const OFFICIAL = { event: "Hujan Lebat disertai Petir dan Angin Kencang", expires: t(15, 0), effective: t(8, 0) };
const URL_ = "wa.me/6281200000000?text=LAPOR";

type Src = "none" | "fcW" | "fcS" | "cap";
function msg(lik: null | { level: "WASPADA" | "SIAGA"; high: boolean; inaction: boolean }, src: Src, final: WarningMessageInput["final"],
	channel: "app" | "wa" = "wa", personal = false) {
	const bm: WarningMessageInput["bmkg"] = {
		official: src === "cap" ? OFFICIAL : null,
		forecastLevel: src === "fcS" ? "SIAGA" : src === "fcW" ? "WASPADA" : "NORMAL",
		windKmh: src === "fcS" ? 50 : src === "fcW" ? 35 : 10,
		weather: "Berawan",
	};
	const blocks = buildWarningMessage({
		beach: "Pantai Lampuuk", final, channel, personal, now: NOW, reportUrl: URL_, kejadianUrl: "samudraapp.com/kejadian",
		lik: lik ? { level: lik.level, signs: "Ada kilat", reporters: 1, highTrust: lik.high, inaction: lik.inaction, startedAt: t(8, 0),
			endsAt: src === "cap" ? t(15, 0) : t(9, 0) } : null,
		bmkg: bm,
	});
	// WhatsApp *bold* is checked in its own test; wording checks use the text without asterisks.
	return channel === "wa" ? toWhatsAppText(blocks).replace(/\*/g, "") : blocks.map((b) => b.map(plain).join("\n")).join("\n\n");
}
const WA = { level: "WASPADA" as const, high: false, inaction: false };
const WI = { level: "WASPADA" as const, high: false, inaction: true };
const SA = { level: "SIAGA" as const, high: true, inaction: false };
const SI = { level: "SIAGA" as const, high: true, inaction: true };

describe("agreed wording, rows 1–15", () => {
	test("row 1 AMAN (app)", () => {
		const m = msg(null, "none", "NORMAL", "app", true);
		expect(m).toContain("STATUS LAUT HARI INI\nLokasi: Pantai Lampuuk\n🟢 AMAN");
		expect(m).toContain("Untuk Anda: boleh melaut. Cuaca bisa berubah");
		expect(m).toContain("Lihat tanda bahaya? Tekan Lapor.");
	});
	test("row 2 BMKG forecast WASPADA", () => {
		const m = msg(null, "fcW", "WASPADA", "app");
		expect(m).toContain("🟡 WASPADA · ANGIN CUKUP KENCANG (±35 km/jam)");
		expect(m).toContain("Sumber: prakiraan BMKG (belum ada laporan dari nelayan)");
		expect(m).toContain("Sebelum berangkat: cek kapal dan mesin, sesuaikan alat tangkap");
		expect(m).not.toContain("Pesan AMAN");
	});
	test("row 3 official BMKG warning only", () => {
		const m = msg(null, "cap", "SIAGA");
		expect(m).toContain("🟠 SIAGA · ANGIN KENCANG\nSumber: peringatan dini BMKG (resmi)\n🕒 Mulai 08.00 · berlaku sampai 15.00 WIB\n");
		expect(m).toContain("petir berbahaya di laut terbuka");
		expect(m).toContain("Di darat: tunda melaut sampai 15.00 WIB. Ikat perahu dan amankan alat tangkap.");
		expect(m).toContain("Di laut: tarik alat tangkap, segera kembali ke darat.");
		expect(m).toContain(`Lihat tanda bahaya? Lapor lewat WhatsApp: ${URL_}`);
		expect(m).toContain("Pesan AMAN dikirim bila peringatan berakhir.");
		expect(m).not.toContain("*");
	});
	test("row 4 WASPADA actionable, sign only", () => {
		const m = msg(WA, "none", "WASPADA");
		expect(m).toContain("🟡 WASPADA · TANDA ANGIN KENCANG\nSumber: 1 nelayan Lampuuk\n");
		expect(m).not.toContain("terpercaya");
		expect(m).toContain("nelayan melihat ada kilat, tanda alam yang biasanya muncul sebelum angin kencang.\nBMKG: tidak ada peringatan.");
		expect(m).toContain("Dampak untuk perahu: angin kencang diperkirakan datang.");
		expect(m).toContain("Laporan Anda membantu memastikan tanda ini.");
		expect(m).not.toMatch(/tunda|kembali ke darat/i);
	});
	test("row 5 WASPADA actionable + official -> SIAGA", () => {
		const m = msg(WA, "cap", "SIAGA");
		expect(m).toContain("Sumber: peringatan dini BMKG (resmi) + 1 nelayan Lampuuk\n");
		expect(m).toContain("Peringatan BMKG sejalan dengan tanda alam nelayan.\nNelayan juga melihat ada kilat.");
		expect(m).toContain("ℹ️ Level SIAGA karena peringatan resmi BMKG.");
		expect(m).not.toContain("Laporan Anda membantu");
	});
	test("row 6 WASPADA actionable + forecast SIAGA", () => {
		const m = msg(WA, "fcS", "SIAGA");
		expect(m).toContain("🟠 SIAGA · ANGIN KENCANG (±50 km/jam)\nSumber: prakiraan BMKG + 1 nelayan Lampuuk");
		expect(m).toContain("Prakiraan BMKG sejalan dengan tanda alam nelayan.");
		expect(m).toContain("ℹ️ Level SIAGA karena prakiraan angin kencang BMKG.");
	});
	test("row 7 WASPADA-I: checklist, no SIAGA actions", () => {
		const m = msg(WI, "none", "WASPADA", "app", true);
		expect(m).toContain("Untuk Anda – lakukan sekarang, jangan hanya berhati-hati:\n✅ Sebelum berangkat");
		expect(m).toContain("Persiapan sekarang memudahkan Anda kembali dengan cepat");
		expect(m).not.toMatch(/tunda|Kejadian/i);
	});
	test("rows 8–9 WASPADA-I with BMKG -> SIAGA checklist, no Kejadian", () => {
		const m = msg(WI, "cap", "SIAGA");
		expect(m).toContain("Lakukan sekarang, jangan hanya berhati-hati:\n✅ Tunda melaut sampai 15.00 WIB.");
		expect(m).toContain("Kembali sekarang lebih aman daripada menunggu angin kencang datang di laut.");
		expect(m).not.toContain("Kejadian");
		expect(m).not.toContain("kejadian");
	});
	test("rows 10–11 SIAGA actionable, trusted sign", () => {
		const m = msg(SA, "none", "SIAGA");
		expect(m).toContain("🟠 SIAGA · TANDA ANGIN KENCANG\nSumber: 1 nelayan Lampuuk (tanda alam terpercaya)");
		expect(m).toContain("Di darat: tunda melaut sampai 09.00 WIB.");
		expect(msg(SA, "fcS", "SIAGA")).not.toContain("ℹ️");
	});
	test("row 12 BAHAYA actionable", () => {
		const m = msg(SA, "cap", "EKSTREM", "app", true);
		expect(m).toContain("🔴 BAHAYA · ANGIN KENCANG\nSumber: peringatan dini BMKG (resmi) + 1 nelayan Lampuuk (tanda alam terpercaya)");
		expect(m).toContain("Untuk Anda: jangan melaut sampai 15.00 WIB. Ikat perahu dengan kuat");
		expect(m).toContain("Di laut: kembali ke darat SEKARANG. Bila tidak bisa, kabari posisi Anda kepada rekan lainnya.");
		expect(m).toContain('Dalam bahaya di laut? Tekan Minta bantuan, lokasi GPS Anda ikut terkirim.');
		expect(m).toContain("ℹ️ BAHAYA karena nelayan dan BMKG sama-sama memberi peringatan.");
	});
	test("rows 13–14 SIAGA-I checklist", () => {
		const m = msg(SI, "none", "SIAGA", "app", true);
		expect(m).toContain("Untuk Anda – lakukan sekarang, jangan hanya berhati-hati:\n✅ Tunda melaut sampai 09.00 WIB.");
	});
	test("row 15 BAHAYA inaction (WhatsApp)", () => {
		const m = msg(SI, "cap", "EKSTREM");
		expect(m).toContain("Jangan Melaut\n✅ Jangan melaut sampai 15.00 WIB.");
		expect(m).toContain("✅ Dalam bahaya di laut? Minta bantuan dan kirim lokasi GPS: samudraapp.com/kejadian");
		expect(m).toContain("Di laut terbuka, perahu kecil sulit bertahan saat angin kencang dan ombak tinggi.");
		expect(m).toContain("📱 Detail di aplikasi SAMUDRA.");
		expect(m).not.toContain("Belum daftar");
	});
	test("WhatsApp bold: headings and labels in *asterisks*, no dikirim, no Belum daftar (rows 1–3)", () => {
		const blocks = buildWarningMessage({ beach: "Pantai Lampuuk", final: "SIAGA", channel: "wa", now: NOW, reportUrl: URL_, lik: null,
			bmkg: { official: { event: "Hujan lebat, petir dan angin kencang", effective: t(8, 0), expires: t(15, 0) }, forecastLevel: "NORMAL" } });
		const m = toWhatsAppText(blocks);
		expect(m).toContain("*STATUS LAUT HARI INI*\nLokasi: Pantai Lampuuk\n🟠 *SIAGA · ANGIN KENCANG*\nSumber: peringatan dini BMKG (resmi)\n🕒 Mulai 08.00 · berlaku sampai 15.00 WIB\n");
		expect(m).toContain("*Apa yang terjadi:*");
		expect(m).toContain("*Dampak untuk perahu:*");
		expect(m).toContain("*Di darat:* tunda melaut sampai 15.00 WIB.");
		expect(m).toContain("*Di laut:* tarik alat tangkap");
		expect(m.endsWith("📱 Detail di aplikasi SAMUDRA.")).toBe(true);
	});
	test("AMAN message when a warning ends", () => {
		expect(formatAllClear("Pantai Lampuuk", "SIAGA", t(9, 0))).toBe(
			"*STATUS LAUT HARI INI*\nLokasi: Pantai Lampuuk\n🟢 *AMAN - Peringatan SIAGA angin kencang sudah berakhir*\n" +
			"Sumber: SAMUDRA (tidak ada laporan baru) + BMKG\n🕒 Berakhir 09.00 WIB\n" +
			"Boleh melaut. Cuaca bisa berubah, tetap amati tanda alam dan laporkan bila melihat tanda bahaya.");
	});
});

describe("group message from the beach state", () => {
	test("MAXIMUM_ALERT (low trust, inaction) uses the WASPADA checklist; sign names, not codes", () => {
		const m = noBold(formatGroupAlert({ beachLocation: "pantai_lhoknga", codes: ["Wn-9"], likLevel: "WASPADA", finalLevel: "WASPADA",
			strategyCode: "MAXIMUM_ALERT", reporterCount: 1, startedAt: t(8, 0), endsAt: t(9, 0), now: NOW }));
		expect(m).toContain("Lokasi: Pantai Lhoknga\n🟡 WASPADA · TANDA ANGIN KENCANG\nSumber: 1 nelayan Lhoknga\n");
		expect(m).toContain("Lakukan sekarang, jangan hanya berhati-hati:");
		expect(m).not.toMatch(/Wn-9|pantai_lhoknga/);
	});
	test("signs in the codebook wording, several joined with '; '", () => {
		const m = noBold(formatGroupAlert({ beachLocation: "pantai_lampuuk", codes: ["Wn-4", "Wn-9"], likLevel: "WASPADA", finalLevel: "WASPADA",
			strategyCode: "ACTIONABLE", reporterCount: 2, startedAt: t(8, 0), endsAt: t(9, 0), now: NOW }));
		expect(m).toContain("nelayan melihat gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat; hujan atau langit tertutup awan tebal, saat angin timur, tanda alam yang biasanya muncul sebelum angin kencang.");
	});
	test("STANDARD + official BMKG: BAHAYA with the trusted label", () => {
		const m = noBold(formatGroupAlert({ beachLocation: "pantai_lampuuk", codes: ["Wn-3"], likLevel: "SIAGA", finalLevel: "EKSTREM",
			strategyCode: "STANDARD", bmkgWarnings: [OFFICIAL], reporterCount: 2, startedAt: t(8, 0), endsAt: t(15, 0), now: NOW }));
		expect(m).toContain("🔴 BAHAYA · ANGIN KENCANG\nSumber: peringatan dini BMKG (resmi) + 2 nelayan Lampuuk (tanda alam terpercaya)");
		expect(m).toContain("Nelayan juga melihat kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi.");
	});
});
