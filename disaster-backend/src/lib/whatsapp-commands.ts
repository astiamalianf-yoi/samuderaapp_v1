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
};

/**
 * WhatsApp label for a risk level. Alert events use two vocabularies (siaga/waspada/ekstrem
 * from the fusion, unsafe-high/unsafe from the legacy feed); both must map, otherwise a real
 * warning is shown as "Aman" in the group.
 */
export function riskLabelFor(level: unknown): string {
	const v = String(level ?? "").toLowerCase();
	if (v === "ekstrem" || v === "siaga" || v === "unsafe-high" || v === "high") return "🔴 BAHAYA";
	if (v === "waspada" || v === "unsafe" || v === "medium") return "🟡 WASPADA";
	return "✅ Aman";
}

const SIGN_KEYWORDS: [RegExp, string][] = [
	[/ombak\s*(besar|tinggi|giang|deras)/i, "Wn-4"],
	[/gelombang\s*(tinggi|besar)/i, "Wn-4"],
	[/air\s*(laut)?\s*naik/i, "Wn-5"],
	[/pasang\s*(tinggi|besar)/i, "Wn-5"],
	[/angin\s*(kencang|ribut|keras|deras|kuat)/i, "Wn-7"],
	[/angin\s*puti(ng|n)g\s*b?eliung/i, "Wn-6"],
	[/hujan\s*(deras|lebat|besar)/i, "Wn-9"],
	[/hujan/i, "Wn-9"],
	[/langit\s*(gelap|hitam|mendung)/i, "Wn-8"],
	[/mendung/i, "Wn-8"],
	[/awan\s*(hitam|gelap|hitam\s*gumpal)/i, "Wn-2"],
	[/petir/i, "Wn-2"],
	[/kilat/i, "Wn-3"],
	[/cuaca\s*(buruk|ekstrem|aneh|tidak\s*biasa|jelek)/i, "Wn-13"],
	[/langit\s*(merah|kemerah)/i, "Wn-8"],
	[/burung\s*camar/i, "Wn-6"],
	[/lumba[- ]?lumba/i, "Wn-5"],
	[/ikan\s*(naik|muncul|loncat)/i, "Wn-13"],
	[/bintang\s*(redup|redam|menghilang)/i, "Wn-9"],
	[/peralihan\s*angin/i, "Wn-7"],
	[/awan\s*(turun|rendah|gumpal|bergumpal)/i, "Wn-1"],
	[/cuaca\s*buruk/i, "Wn-1"],
];

const BEACH_DISPLAY: Record<string, string> = {
	pantai_lampuuk: "Pantai Lampuuk",
	pantai_lhoknga: "Pantai Lhoknga",
	pantai_ulee_lheue: "Pantai Ulee Lheue",
	pantai_depok: "Pantai Depok",
	pantai_samas: "Pantai Samas",
};

const LIK_LABELS: Record<string, string> = {
	"WN-1": "Awan turun",
	"WN-2": "Awan bergumpal",
	"WN-3": "Kilat",
	"WN-4": "Ombak besar",
	"WN-5": "Lumba-lumba",
	"WN-6": "Burung camar",
	"WN-7": "Peralihan angin",
	"WN-8": "Langit merah",
	"WN-9": "Bintang redup",
	"WN-13": "Ikan naik",
};

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

	const matchedCodes = new Set<string>();
	for (const [regex, code] of SIGN_KEYWORDS) {
		if (regex.test(lower)) {
			matchedCodes.add(code);
		}
	}

	if (matchedCodes.size === 0) {
		return { ok: false, missing: "signs" };
	}

	return { ok: true, beachLocation: location, likCodes: [...matchedCodes] };
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
	return "Di pantai mana, Bang? Lampuuk, Lhoknga, Ulee Lheue, Depok, atau Samas?";
}

export function getMissingSignsMessage(): string {
	return "Tanda alamnya apa, Bang? Contoh: ombak besar, angin kencang, hujan deras, langit gelap.";
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
