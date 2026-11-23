/**
 * Warning message wording, agreed 23 Nov 2026 (Development/Warning Strategy Matrix.docx, table 3,
 * "Proposed wording" columns, rows 1–15; based on the literature review on warning messages).
 *
 * One builder for the app card and the WhatsApp group message, so both say the same thing.
 * The SAME FILE is kept in frontend/src/lib/warningMessage.ts: change both together.
 *
 * Layout: three blocks (status/source/time; what is happening, impact, actions; closing lines).
 * Lines may hold **bold** parts; the WhatsApp text has them removed (no *bold* markup).
 *
 * Rules:
 * - Heading: LIK sign only -> "TANDA ANGIN KENCANG"; LIK + official BMKG warning -> "ANGIN KENCANG";
 *   with a BMKG forecast of strong wind -> "ANGIN KENCANG (±N km/jam)".
 * - Source: "(tanda alam terpercaya)" only for a high-trust sign; nothing for a low-trust sign.
 * - Actions by level: WASPADA = adjust; SIAGA = delay the trip / go back; BAHAYA = do not go out,
 *   plus the Kejadian (help + GPS) line. Inaction strategies get the same actions as a ✅ checklist
 *   with a "why" line.
 * - Fishermen's sign first: "Peringatan/Prakiraan BMKG sejalan dengan tanda alam nelayan."
 */
export type MsgLevel = "NORMAL" | "WASPADA" | "SIAGA" | "EKSTREM";

export interface WarningMessageInput {
	/** Display name, e.g. "Pantai Lampuuk". */
	beach: string;
	/** Final level shown on the card (LIK fused with BMKG). */
	final: MsgLevel;
	/** Fishermen's warning, when one is active. */
	lik?: {
		/** The level of the strategy message (personal or community). */
		level: MsgLevel;
		/** Signs, e.g. "Ada kilat, Awan tebal". */
		signs: string;
		reporters: number;
		highTrust: boolean;
		inaction: boolean;
		startedAt: number;
		endsAt?: number | null;
	} | null;
	bmkg: {
		/** Official BMKG warning (nowcast/CAP) that covers the beach. */
		official?: { event: string; expires?: number | null; effective?: number | null } | null;
		/** BMKG level from the forecast alone (wind / weather), without the official warning. */
		forecastLevel: MsgLevel;
		windKmh?: number | null;
		weather?: string | null;
		/** Forecast time window with bad weather (BMKG 3-hourly slots), e.g. 08.00–15.00. */
		period?: { start: number; end: number } | null;
	};
	channel: "app" | "wa";
	/** Registered fisherman with his own strategy (app card only): "Untuk Anda". */
	personal?: boolean;
	now?: number;
	/** WhatsApp report link (wa.me/…?text=LAPOR) and the Kejadian page URL. */
	reportUrl?: string | null;
	kejadianUrl?: string | null;
}

const RANK: Record<MsgLevel, number> = { NORMAL: 0, WASPADA: 1, SIAGA: 2, EKSTREM: 3 };
const HEAD: Record<MsgLevel, { emoji: string; label: string }> = {
	NORMAL: { emoji: "🟢", label: "AMAN" },
	WASPADA: { emoji: "🟡", label: "WASPADA" },
	SIAGA: { emoji: "🟠", label: "SIAGA" },
	EKSTREM: { emoji: "🔴", label: "BAHAYA" },
};

export const levelLabel = (l: MsgLevel) => HEAD[l].label;

export const timeWib = (ms?: number | null) =>
	ms ? new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".") : "";

const shortBeach = (b: string) => b.replace(/^pantai\s+/i, "");
/** Sign names inside a sentence: "Ada kilat, Langit mendung" -> "ada kilat, langit mendung". */
const lowerFirst = (s: string) => s.split(", ").map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ");

/** Removes the **bold** markers (WhatsApp text has no bold markup). */
export const plain = (line: string) => line.replace(/\*\*/g, "");

export function buildWarningMessage(p: WarningMessageInput): string[][] {
	const now = p.now ?? Date.now();
	const wa = p.channel === "wa";
	// WhatsApp group and unregistered app users report through the bot (wa.me link); registered app users press Lapor.
	const viaWa = (wa || !p.personal) && !!p.reportUrl;
	const personal = !wa && !!p.personal;
	const lik = p.lik ?? null;
	const official = p.bmkg.official ?? null;
	const wind = p.bmkg.windKmh != null ? Math.round(p.bmkg.windKmh) : null;
	const fcSiaga = !official && RANK[p.bmkg.forecastLevel] >= RANK.SIAGA;
	const fcWaspada = !official && p.bmkg.forecastLevel === "WASPADA";
	const final = p.final;
	const H = HEAD[final];
	const clock = wa ? "🕒 " : "";
	const petir = official ? /petir|kilat/i.test(official.event) : false;

	// ---------- AMAN (row 1)
	if (final === "NORMAL" && !lik) {
		const fc = wind != null
			? `Prakiraan BMKG: angin ±${wind} km/jam${p.bmkg.weather ? `, ${p.bmkg.weather.toLowerCase()}` : ", laut tenang"}.`
			: "Prakiraan BMKG: tidak ada cuaca buruk.";
		return [
			["**STATUS LAUT HARI INI**", `Lokasi: ${p.beach}`, `${H.emoji} **${H.label}**`, "Tidak ada peringatan dari nelayan maupun BMKG saat ini.", fc],
			[`${personal ? "**Untuk Anda:** boleh" : "Boleh"} melaut. Cuaca bisa berubah, cek kembali sebelum berangkat, bawa pelampung dan amati tanda alam.`],
			[viaWa ? `Lihat tanda bahaya? Lapor lewat WhatsApp: ${p.reportUrl}` : "Lihat tanda bahaya? Tekan **Lapor**.",
				...(wa ? [] : [`Diperbarui ${timeWib(now)} WIB`]),
				...(!wa && !personal ? ["Daftar agar dapat peringatan khusus untuk Anda."] : [])],
		];
	}

	// ---------- Heading, source, time
	let hazard: string;
	if (official) hazard = /angin/i.test(official.event) || lik ? "ANGIN KENCANG" : official.event.toUpperCase();
	else if (fcSiaga) hazard = `ANGIN KENCANG${wind != null ? ` (±${wind} km/jam)` : ""}`;
	else if (lik) hazard = "TANDA ANGIN KENCANG";
	else hazard = wind != null && wind >= 30 ? `ANGIN CUKUP KENCANG (±${wind} km/jam)` : "CUACA KURANG BAIK";

	const nel = lik ? `${lik.reporters} nelayan ${shortBeach(p.beach)}${lik.highTrust ? " (tanda alam terpercaya)" : ""}` : "";
	let source: string;
	if (official) source = lik ? `peringatan dini BMKG (resmi) + ${nel}` : "peringatan dini BMKG (resmi)";
	else if (fcSiaga && lik) source = `prakiraan BMKG + ${nel}`;
	else if (lik) source = nel;
	else source = "prakiraan BMKG (belum ada laporan dari nelayan)";

	const end = Math.max(lik?.endsAt ?? 0, official?.expires ?? 0) || null;
	const sent = ""; // "· dikirim HH.MM" removed (matrix rows 3–4 revised 23 Nov)
	let time: string;
	if (lik) time = `Mulai ${timeWib(lik.startedAt)}${end ? ` · berlaku sampai ${timeWib(end)} WIB` : ""}${sent}`;
	else if (official) time = `${official.effective ? `Mulai ${timeWib(official.effective)} · b` : "B"}erlaku sampai ${timeWib(official.expires)} WIB${sent}`;
	else {
		const pr = p.bmkg.period;
		const when = pr?.start && pr?.end ? `Prakiraan ${timeWib(pr.start)}–${timeWib(pr.end)} WIB` : "Prakiraan BMKG saat ini";
		time = `${when}${wa ? sent : ` · diperbarui ${timeWib(now)} WIB`}`;
	}

	const block1 = ["**STATUS LAUT HARI INI**", `Lokasi: ${p.beach}`, `${H.emoji} **${H.label} · ${hazard}**`, `Sumber: ${source}`, `${clock}${time}`];

	// ---------- What is happening
	const block2: string[] = [];
	if (official) {
		block2.push(`**Apa yang terjadi:** BMKG memperingatkan ${official.event.toLowerCase()} di wilayah ${p.beach}.${lik ? " Peringatan BMKG sejalan dengan tanda alam nelayan." : ""}`);
		if (lik) block2.push(`Nelayan juga melihat ${lowerFirst(lik.signs)}.`);
	} else if (fcSiaga) {
		block2.push(`**Apa yang terjadi:** BMKG memperkirakan angin${wind != null ? ` ±${wind} km/jam` : " kencang"} di ${shortBeach(p.beach)}.${lik ? " Prakiraan BMKG sejalan dengan tanda alam nelayan." : ""}`);
		if (lik) block2.push(`Nelayan juga melihat ${lowerFirst(lik.signs)}.`);
	} else if (lik) {
		block2.push(`**Apa yang terjadi:** nelayan melihat ${lowerFirst(lik.signs)}, tanda alam yang biasanya muncul sebelum angin kencang.`);
		const bm = fcWaspada
			? wind != null && wind >= 30 ? `prakiraan angin ±${wind} km/jam.` : `prakiraan ${(p.bmkg.weather ?? "cuaca kurang baik").toLowerCase()}.`
			: "tidak ada peringatan.";
		block2.push(`BMKG: ${bm}`);
	}

	// ---------- Impact
	let impact: string;
	if (final === "EKSTREM") impact = `angin kencang dan ombak tinggi sangat berbahaya untuk perahu kecil${petir ? "; petir berbahaya di laut terbuka" : ""}.`;
	else if (final === "SIAGA") {
		if (official) impact = `angin kencang dan ombak tinggi berbahaya untuk perahu kecil${petir ? "; petir berbahaya di laut terbuka" : ""}.`;
		else if (fcSiaga) impact = `angin${wind != null ? ` ±${wind} km/jam` : " kencang"} dan ombak tinggi berbahaya untuk perahu kecil.`;
		else impact = "angin kencang diperkirakan datang, berbahaya untuk perahu kecil.";
	} else impact = lik ? "angin kencang diperkirakan datang." : "ombak lebih tinggi dari biasa, perahu kecil bisa sulit dikendalikan.";
	block2.push(`**Dampak untuk perahu:** ${impact}`);

	// ---------- Actions
	const inaction = !!lik?.inaction;
	const until = end ? `sampai ${timeWib(end)} WIB` : "selama prakiraan angin kencang masih berlaku";
	const kej = wa
		? `Dalam bahaya di laut? Minta bantuan dan kirim lokasi GPS: ${p.kejadianUrl ?? "aplikasi SAMUDRA, menu Kejadian"}`
		: `Dalam bahaya di laut? Tekan **Kejadian** → "Saya butuh bantuan sekarang" dan bagikan lokasi GPS Anda.`;
	if (final === "WASPADA") {
		const prep = `cek kapal dan mesin, sesuaikan alat tangkap, bawa pelampung${lik ? ", dan amati tanda alam lain" : ", dan amati tanda alam"}.`;
		const sea = "tetap waspada dan amati tanda alam. Bila angin bertambah kencang atau cuaca semakin buruk, segera tarik alat tangkap.";
		if (!inaction) {
			block2.push(personal ? `**Untuk Anda:** sebelum berangkat, ${prep}` : `**Sebelum berangkat:** ${prep}`, `**Di laut:** ${sea}`);
		} else {
			block2.push(
				personal ? "**Untuk Anda – lakukan sekarang, jangan hanya berhati-hati:**" : "**Lakukan sekarang, jangan hanya berhati-hati:**",
				"✅ Sebelum berangkat: cek kapal dan mesin, sesuaikan alat tangkap, bawa pelampung.",
				"✅ Amati tanda alam lain sebelum dan selama melaut.",
				"✅ Di laut: bila angin bertambah kencang atau cuaca semakin buruk, segera tarik alat tangkap.",
				"Persiapan sekarang memudahkan Anda kembali dengan cepat bila angin kencang datang.",
			);
		}
	} else if (final === "SIAGA") {
		if (!inaction) {
			block2.push(`${personal ? "**Untuk Anda:**" : "**Di darat:**"} tunda melaut ${until}. Ikat perahu dan amankan alat tangkap.`,
				"**Di laut:** tarik alat tangkap, segera kembali ke darat.");
		} else {
			block2.push(
				personal ? "**Untuk Anda – lakukan sekarang, jangan hanya berhati-hati:**" : "**Lakukan sekarang, jangan hanya berhati-hati:**",
				`✅ Tunda melaut ${until}. Ikat perahu dan amankan alat tangkap.`,
				"✅ Di laut: tarik alat tangkap, segera kembali ke darat.",
				"Kembali sekarang lebih aman daripada menunggu angin kencang datang di laut.",
			);
		}
	} else {
		if (!inaction) {
			block2.push(`${personal ? "**Untuk Anda:**" : "**Di darat:**"} jangan melaut ${until}. Ikat perahu dengan kuat dan amankan alat tangkap.`,
				"**Di laut:** kembali ke darat SEKARANG. Bila tidak bisa, kabari posisi Anda kepada rekan lainnya.", kej);
		} else {
			block2.push(
				personal ? "**Untuk Anda – Jangan Melaut**" : "**Jangan Melaut**",
				`✅ Jangan melaut ${until}. Ikat perahu dengan kuat dan amankan alat tangkap.`,
				"✅ Di laut: kembali ke darat SEKARANG. Bila tidak bisa, kabari posisi Anda kepada rekan lainnya.",
				`✅ ${kej}`,
				"Di laut terbuka, perahu kecil sulit bertahan saat angin kencang dan ombak tinggi.",
			);
		}
	}

	// ---------- Closing
	const block3: string[] = [];
	if (lik && final === "EKSTREM") block3.push("ℹ️ BAHAYA karena nelayan dan BMKG sama-sama memberi peringatan.");
	else if (lik && RANK[final] > RANK[lik.level]) {
		block3.push(official ? `ℹ️ Level ${H.label} karena peringatan resmi BMKG.` : `ℹ️ Level ${H.label} karena prakiraan angin kencang BMKG.`);
	}
	const confirm = lik && !official && !fcSiaga;
	const ask = lik ? "Lihat tanda alam yang sama atau tanda lain?" : "Lihat tanda bahaya?";
	if (viaWa) {
		block3.push(`${ask} Lapor lewat WhatsApp: ${p.reportUrl}`);
		if (confirm) block3.push("Laporan Anda membantu memastikan tanda ini.");
	} else {
		block3.push(`${ask} Tekan **Lapor**.${confirm ? " Laporan Anda membantu memastikan tanda ini." : ""}`);
	}
	if (lik || official) block3.push("Pesan AMAN dikirim bila peringatan berakhir.");
	if (wa) block3.push("📱 Detail di aplikasi SAMUDRA.");
	else if (!personal) block3.push("Daftar agar dapat peringatan khusus untuk Anda.");

	return [block1, block2, block3];
}

/** WhatsApp text: blocks separated by an empty line, **bold** as WhatsApp *bold*. */
export const toWhatsAppText = (blocks: string[][]) => blocks.map((b) => b.map(waBold).join("\n")).join("\n\n");

/** **bold** -> WhatsApp *bold*. */
export const waBold = (line: string) => line.replace(/\*\*([^*]+)\*\*/g, "*$1*");

/** One-time WhatsApp message when a WASPADA/SIAGA/BAHAYA warning has ended (row 1). */
export function formatAllClear(beach: string, ended: MsgLevel, endedAt: number): string {
	return [
		"*STATUS LAUT HARI INI*",
		`Lokasi: ${beach}`,
		`🟢 *AMAN - Peringatan ${levelLabel(ended)} angin kencang sudah berakhir*`,
		"Sumber: SAMUDRA (tidak ada laporan baru) + BMKG",
		`🕒 Berakhir ${timeWib(endedAt)} WIB`,
		"Boleh melaut. Cuaca bisa berubah, tetap amati tanda alam dan laporkan bila melihat tanda bahaya.",
	].join("\n");
}

/** Strategy code -> trust and behaviour (paper matrix). */
export const strategyTraits = (code?: string | null) => ({
	highTrust: code === "STANDARD" || code === "EXTRA_WARNING",
	inaction: code === "EXTRA_WARNING" || code === "MAXIMUM_ALERT",
});
