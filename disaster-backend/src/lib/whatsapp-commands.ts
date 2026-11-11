import { ALLOWED_BEACH_LOCATIONS } from "../types";

const BEACH_ALIASES: Record<string, string> = {
	lampuuk: "pantai_lampuuk",
	"pantai lampuuk": "pantai_lampuuk",
	lhoknga: "pantai_lhoknga",
	"pantai lhoknga": "pantai_lhoknga",
	"ulee lheue": "pantai_ulee_lheue",
	"pantai ulee lheue": "pantai_ulee_lheue",
	ulhee: "pantai_ulee_lheue",
	depok: "pantai_depok",
	"pantai depok": "pantai_depok",
	samas: "pantai_samas",
	"pantai samas": "pantai_samas",
	// West Java: the specific beaches come before "pangandaran" (also the regency name),
	// so "batu karas pangandaran" is read as Batu Karas.
	"batu karas": "pantai_batu_karas",
	batukaras: "pantai_batu_karas",
	"bojong salawe": "pantai_bojongsalawe",
	bojongsalawe: "pantai_bojongsalawe",
	"bojong salawi": "pantai_bojongsalawe",
	pangandaran: "pantai_pangandaran",
	pananjung: "pantai_pangandaran",
};

/**
 * WhatsApp label for a risk level. Alert events use two vocabularies (siaga/waspada/ekstrem
 * from the fusion, unsafe-high/unsafe from the legacy feed); both must map, otherwise a real
 * warning is shown as "Aman" in the group.
 */
export function riskLabelFor(level: unknown): string {
	const v = String(level ?? "").toLowerCase();
	if (v === "ekstrem" || v === "bahaya") return "🔴 BAHAYA";
	if (v === "siaga" || v === "unsafe-high" || v === "high") return "🟠 SIAGA";
	if (v === "waspada" || v === "unsafe" || v === "medium") return "🟡 WASPADA";
	return "✅ Aman";
}

// Words between two key words, e.g. "awan [yang tebal] turun" (at most 3 words, no nested backtracking).
const GAP = String.raw`(?:\s+\S+){0,3}?\s+`;
const rx = (s: string) => new RegExp(s.replace(/_/g, GAP), "i");

/**
 * Free-text phrase -> sign code, following the codebook of the 17 strong-wind signs (Wn-1 … Wn-17;
 * the same descriptions as the app's sign tiles, frontend/src/constants/signs.ts).
 * Order matters: specific phrases come first, and the text a rule matched is removed before the
 * next rule is tried, so one phrase gives one sign.
 * Phrases that are not a codebook sign (angin kencang, air laut naik, pasang, puting beliung,
 * cuaca buruk, ikan naik, langit merah) are deliberately not mapped.
 */
export const SIGN_KEYWORDS: [RegExp, string][] = [
	// Wn-16 Bulan terlihat di antara penjepit bintang Kalajengking
	[rx(String.raw`bulan_(?:\S+\s+){0,3}?(?:kalajengking|bintang\s+kala|scorpi\w*)`), "Wn-16"],
	[rx(String.raw`(?:kalajengking|bintang\s+kala)_(?:\S+\s+){0,3}?bulan`), "Wn-16"],
	// Wn-14 Bintang terlihat mendekati atau sejajar dengan bulan
	[rx(String.raw`bintang_(?:dekat|mendekati|mendekat|sejajar|di\s+samping|di\s+sebelah)(?:\s+\S+){0,2}?\s+bulan`), "Wn-14"],
	[rx(String.raw`bintang\s+(?:dekat|mendekati|mendekat|sejajar)(?:\s+\S+){0,2}?\s+bulan`), "Wn-14"],
	[rx(String.raw`bulan_(?:dekat|sejajar)(?:\s+\S+){0,2}?\s+bintang`), "Wn-14"],
	// Wn-13 Bintang tidak terlihat di malam hari, saat angin timur
	[rx(String.raw`bintang(?:\s+\S+){0,2}?\s+(?:tidak\s+(?:terlihat|kelihatan|tampak|muncul|ada)|hilang|menghilang|redup|lenyap)`), "Wn-13"],
	[rx(String.raw`tidak\s+(?:ada|terlihat|kelihatan|tampak)\s+bintang`), "Wn-13"],
	// Wn-12 Banyak bintang di malam hari berkelap kelip, saat angin barat
	[rx(String.raw`bintang(?:\s+\S+){0,2}?\s+(?:berkelip|berkelap|kelap[- ]?kelip|kerlap[- ]?kerlip|berkedip)`), "Wn-12"],
	[/banyak\s+bintang/i, "Wn-12"],
	// Wn-17 Paus muncul ke permukaan laut dan mengibaskan ekornya
	[/\bpaus\b/i, "Wn-17"],
	// Wn-15 Kecoak berterbangan di dalam kapal
	[/kecoa/i, "Wn-15"],
	// Wn-5 Lumba-lumba mendekati perahu
	[/lumba[- ]?lumba|\blumba\b/i, "Wn-5"],
	// Wn-6 Burung camar terbang tergesa sambil bersuara keras
	[/(?:burung\s+)?camar/i, "Wn-6"],
	// Wn-11 Suara dentuman terdengar 1 atau 7 kali
	[/dentum\w*|suara\s+(?:ledakan|gelegar)/i, "Wn-11"],
	// Wn-3 Kilat muncul di salah satu sisi langit ataupun saling berbalas
	[/kilat|petir|halilintar/i, "Wn-3"],
	// Wn-7 Pada masa peralihan angin barat ke angin timur
	[rx(String.raw`(?:peralihan|pergantian|perubahan|pancaroba)\s+angin`), "Wn-7"],
	[rx(String.raw`angin(?:\s+\S+){0,2}?\s+(?:berubah|berganti|beralih|pindah)`), "Wn-7"],
	[rx(String.raw`angin\s+barat\s+(?:ke|jadi|menjadi|berganti)\s+(?:angin\s+)?timur`), "Wn-7"],
	// Wn-4 Gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat
	[rx(String.raw`(?:ombak|gelombang)(?:\s+\S+){0,2}?\s+(?:besar|tinggi|rapat|berubah|kuat|deras|giang)`), "Wn-4"],
	// Wn-1 Awan tampak turun ke bawah membentuk gumpalan
	[rx(String.raw`awan(?:\s+\S+){0,3}?\s+(?:turun|merendah)(?:\s+(?:dan\s+)?(?:membentuk\s+)?(?:gumpalan|bergumpal|menggumpal|bergerombol))?`), "Wn-1"],
	// Wn-2 Awan bergumpal dalam beberapa kelompok yang tampak saling mendekat atau menyatu
	[rx(String.raw`awan(?:\s+\S+){0,2}?\s+(?:bergumpal|menggumpal|gumpal|bergerombol|berkelompok|mendekat|menyatu)`), "Wn-2"],
	[/saling\s+(?:mendekat|menyatu)|bergumpal|bergerombol/i, "Wn-2"],
	// Wn-9 Hujan atau langit tertutup awan tebal, saat angin timur
	[/hujan/i, "Wn-9"],
	[rx(String.raw`awan(?:\s+\S+){0,1}?\s+(?:tebal|gelap|hitam|pekat)`), "Wn-9"],
	[rx(String.raw`(?:tebal|gelap|hitam)\s+awan`), "Wn-9"],
	[rx(String.raw`langit(?:\s+\S+){0,1}?\s+(?:tertutup|gelap|hitam)`), "Wn-9"],
	// Wn-8 Langit mendung namun tidak terlalu gelap
	[/mendung|langit\s+(?:kelabu|abu[- ]?abu)/i, "Wn-8"],
	// Wn-10 Cuaca cerah tanpa awan, saat angin barat
	[/cerah/i, "Wn-10"],
];

/** Common short forms and typos seen in the group, written out before matching. */
const SHORT_FORMS: [RegExp, string][] = [
	[/\bawn\b/g, "awan"],
	[/\b(?:glp|gelp|glap)\b/g, "gelap"],
	[/\b(?:ombk|omba)\b/g, "ombak"],
	[/\b(?:bsr|besr)\b/g, "besar"],
	[/\b(?:tggi|tngi|tinggi2)\b/g, "tinggi"],
	[/\b(?:bntg|bntang|bitang)\b/g, "bintang"],
	[/\b(?:hjn|ujan)\b/g, "hujan"],
	[/\b(?:tbl|tebel)\b/g, "tebal"],
	[/\b(?:gak|ga|gk|nggak|ngga|enggak|tdk|tak)\b/g, "tidak"],
	[/\b(?:keliatan|kliatan)\b/g, "kelihatan"],
	[/\b(?:pntai|pantay|pnt)\b/g, "pantai"],
];

export function normaliseReportText(text: string): string {
	let s = text.toLowerCase().replace(/[.,!?;:()]+/g, " ");
	for (const [re, to] of SHORT_FORMS) s = s.replace(re, to);
	return s.replace(/\s+/g, " ").trim();
}

/** Sign codes in a free-text report, in codebook order of the rules above. */
export function matchSignCodes(text: string): string[] {
	let rest = ` ${normaliseReportText(text)} `;
	const codes = new Set<string>();
	for (const [regex, code] of SIGN_KEYWORDS) {
		const m = rest.match(regex);
		if (m && m.index !== undefined) {
			codes.add(code);
			rest = rest.slice(0, m.index) + " ".repeat(m[0].length) + rest.slice(m.index + m[0].length);
		}
	}
	return [...codes];
}

export const BEACH_DISPLAY: Record<string, string> = {
	pantai_lampuuk: "Pantai Lampuuk",
	pantai_lhoknga: "Pantai Lhoknga",
	pantai_ulee_lheue: "Pantai Ulee Lheue",
	pantai_depok: "Pantai Depok",
	pantai_samas: "Pantai Samas",
	pantai_pangandaran: "Pantai Pangandaran",
	pantai_batu_karas: "Pantai Batu Karas",
	pantai_bojongsalawe: "Pantai Bojongsalawe",
};

/** Short sign names, as on the app's sign tiles (codebook). */
const LIK_LABELS: Record<string, string> = {
	"WN-1": "Awan turun",
	"WN-2": "Awan bergumpal",
	"WN-3": "Ada kilat",
	"WN-4": "Ombak besar & rapat",
	"WN-5": "Lumba-lumba mendekat",
	"WN-6": "Camar ribut",
	"WN-7": "Peralihan angin",
	"WN-8": "Langit mendung",
	"WN-9": "Hujan, awan tebal",
	"WN-10": "Cerah tanpa awan",
	"WN-11": "Suara dentuman",
	"WN-12": "Bintang berkelip",
	"WN-13": "Bintang hilang",
	"WN-14": "Bintang dekat bulan",
	"WN-15": "Kecoak beterbangan",
	"WN-16": "Bulan di bintang kala",
	"WN-17": "Paus muncul",
};

export function signLabel(code: string): string {
	return LIK_LABELS[code.toUpperCase()] ?? code;
}

export type LaporResult =
	| { ok: true; beachLocation: string; likCodes: string[] }
	| { ok: false; missing: "location" | "signs" };

export function parseLaporCommand(text: string): LaporResult {
	const lower = text.toLowerCase();

	let location: string | null = null;
	for (const [alias, slug] of Object.entries(BEACH_ALIASES)) {
		if (lower.includes(alias)) {
			location = slug;
			break;
		}
	}

	if (!location) {
		for (const slug of ALLOWED_BEACH_LOCATIONS) {
			if (lower.includes(slug.replace(/_/g, " "))) {
				location = slug;
				break;
			}
		}
	}

	if (!location) {
		return { ok: false, missing: "location" };
	}

	const matchedCodes = matchSignCodes(lower);

	if (matchedCodes.length === 0) {
		return { ok: false, missing: "signs" };
	}

	return { ok: true, beachLocation: location, likCodes: matchedCodes };
}

export function parsePeringatanCommand(text: string): string | null {
	const lower = text.toLowerCase();

	for (const [alias, slug] of Object.entries(BEACH_ALIASES)) {
		if (lower.includes(alias)) {
			return slug;
		}
	}

	for (const slug of ALLOWED_BEACH_LOCATIONS) {
		if (lower.includes(slug.replace(/_/g, " "))) {
			return slug;
		}
	}

	return null;
}

export function getMissingLocationMessage(): string {
	return "Di pantai mana, Bang? Lampuuk, Lhoknga, Ulee Lheue, Depok, Samas, Pangandaran, Batu Karas, atau Bojongsalawe?";
}

export function getMissingSignsMessage(): string {
	return "Tanda alamnya apa, Bang? Contoh: ombak besar, ada kilat, awan turun, awan bergumpal, langit mendung, hujan, bintang tidak terlihat, peralihan angin, camar ribut, lumba-lumba mendekat.";
}

export function formatAlertsResponse(alerts: any[], beachFilter?: string | null): string {
	const filtered = beachFilter
		? alerts.filter((a: any) => a.beachLocation === beachFilter)
		: alerts;

	if (filtered.length === 0) {
		const beachName = beachFilter ? BEACH_DISPLAY[beachFilter] || beachFilter : null;
		if (beachName) {
			return `✅ Kondisi Aman di ${beachName}\n\nAlhamdulillah cuaca aman di ${beachName}. Tetap waspada.`;
		}
		return "✅ CUACA AMAN\n\nAlhamdulillah cuaca aman di semua pantai hari ini.\nTetap waspada dan perhatikan tanda-tanda alam ya, Bang.";
	}

	const parts = filtered.map((alert: any) => {
		const riskLabel = riskLabelFor(alert.riskLevel);

		const beachName = BEACH_DISPLAY[alert.beachLocation] || alert.beachLocation;
		const date = new Date(alert.serverTimestamp).toLocaleString("id-ID", {
			timeZone: "Asia/Jakarta",
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

		const firstReport = new Date(alert.firstReportAt).toLocaleTimeString("id-ID", {
			timeZone: "Asia/Jakarta",
			hour: "2-digit",
			minute: "2-digit",
		});
		const lastReport = new Date(alert.lastReportAt).toLocaleTimeString("id-ID", {
			timeZone: "Asia/Jakarta",
			hour: "2-digit",
			minute: "2-digit",
		});

		const signLabels = (alert.triggeredCodes || [])
			.map((code: string) => LIK_LABELS[code.toUpperCase()] || code)
			.join(", ");

		return [
			`⚠️ PERINGATAN — ${riskLabel} di ${beachName}`,
			date,
			"",
			`👥 Dilaporkan oleh ${alert.reporterCount} nelayan`,
			`🕐 Mulai: ${firstReport} WIB | Berakhir: ${lastReport} WIB`,
			"",
			"Tanda Alam Terdeteksi:",
			`- ${signLabels}`,
			"",
			"Rekomendasi Aksi:",
			alert.actionRecommendation || "Tidak ada rekomendasi",
		].join("\n");
	});

	return parts.join("\n\n---\n\n");
}

/** "!kejadian": the four incident types of "Lapor kejadian" in the app (codebook hazards). */
export const INCIDENT_KEYWORDS: [RegExp, string][] = [
	[/\bangin\s*(kencang|ribut|besar|kuat|keras|badai)\b|puting\s*beliung/, "angin_kencang"],
	[/\b(gelombang|ombak)\s*(besar|tinggi|ekstrem|ekstrim|ganas)\b/, "gelombang_ekstrem"],
	[/\bbadai\b|\btopan\b|hujan\s*(lebat|deras|badai)/, "badai"],
	[/\barus\s*(kuat|deras|kencang)\b/, "arus_kuat"],
];

export const INCIDENT_NAMES: Record<string, string> = {
	angin_kencang: "Angin kencang di laut",
	gelombang_ekstrem: "Gelombang ekstrem",
	badai: "Badai / hujan lebat",
	arus_kuat: "Arus kuat",
};

export type KejadianResult = { types: string[]; beachLocation: string | null };

/** "!kejadian angin kencang di lampuuk" -> types + beach (beach may be missing: his home beach). */
export function parseKejadianCommand(text: string): KejadianResult {
	const lower = normaliseReportText(text.toLowerCase().replace(/^!kejadian/, " "));
	const types = INCIDENT_KEYWORDS.filter(([re]) => re.test(lower)).map(([, t]) => t);
	return { types, beachLocation: parsePeringatanCommand(text) };
}
