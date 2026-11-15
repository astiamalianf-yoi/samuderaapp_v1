import { signLabel, BEACH_DISPLAY } from "./whatsapp-commands";

/**
 * The fishermen's warning as sent to a beach's WhatsApp group. It mirrors the app's Beranda card for
 * that beach (the community view, as an unregistered user sees it): heading, final level, the community
 * strategy, why the level is higher than the strategy (BMKG), signs, reporters and end time.
 * One format for warnings raised from the app and from !lapor (15 Nov 2026).
 */
type LevelKey = "NORMAL" | "WASPADA" | "SIAGA" | "EKSTREM";
const LEVEL: Record<LevelKey, { label: string; sub: string; emoji: string; rank: number }> = {
	NORMAL: { label: "AMAN", sub: "Tidak ada peringatan", emoji: "✅", rank: 0 },
	WASPADA: { label: "WASPADA", sub: "Hati-hati, pantau terus", emoji: "⚠️", rank: 1 },
	SIAGA: { label: "SIAGA", sub: "Bahaya, siapkan perlindungan", emoji: "🟠", rank: 2 },
	EKSTREM: { label: "BAHAYA", sub: "Jangan melaut", emoji: "🛑", rank: 3 },
};
const STRATEGY: Record<string, { title: string; action: string }> = {
	STANDARD: { title: "Tanda alam terpercaya terlihat", action: "Ikuti tindakan di bawah sebelum melaut." },
	EXTRA_WARNING: { title: "Lakukan perlindungan sekarang", action: "Jangan hanya berhati-hati: amankan alat tangkap dan sesuaikan jadwal melaut." },
	ENHANCED_MONITORING: { title: "Pantau tanda alam lain", action: "Tanda ini belum terbukti akurat. Amati tanda lain dan cek BMKG sebelum melaut." },
	MAXIMUM_ALERT: { title: "Tunda melaut", action: "Amankan alat tangkap dan hubungi Panglima Laot atau ketua kelompok sebelum berangkat." },
};
const norm = (v: unknown): LevelKey => {
	const s = String(v ?? "").toUpperCase();
	if (s === "BAHAYA") return "EKSTREM";
	if (s === "AMAN") return "NORMAL";
	return s in LEVEL ? (s as LevelKey) : "NORMAL";
};
const wib = (ms: number) =>
	new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace(":", ".") + " WIB";

export function formatGroupAlert(p: {
	beachLocation: string;
	/** All signs in the warning (earlier ones too). */
	codes: string[];
	/** The fishermen's own level for the beach (ml.lik_risk_level). */
	likLevel: unknown;
	/** The final level shown on the card (LIK fused with BMKG now). */
	finalLevel: unknown;
	strategyCode?: string | null;
	bmkgLevel?: unknown;
	bmkgWarnings?: { event?: string; expires?: number | null }[];
	reporterCount: number;
	startedAt: number;
	endsAt?: number | null;
}): string {
	const beach = BEACH_DISPLAY[p.beachLocation] ?? p.beachLocation;
	const fin = norm(p.finalLevel), lik = norm(p.likLevel), bm = norm(p.bmkgLevel);
	const L = LEVEL[fin];
	const warnings = (p.bmkgWarnings ?? []).filter((w) => w.event);
	const w0 = warnings[0];
	const bmkgPart = w0 ? `${w0.event}${w0.expires ? ` sampai ${wib(w0.expires)}` : ""}` : null;
	const fromBmkg = LEVEL[bm].rank >= LEVEL.SIAGA.rank || warnings.length > 0;
	const strat = p.strategyCode ? STRATEGY[p.strategyCode] : undefined;
	const lines = [
		`⚠️ *PERINGATAN DARI NELAYAN${fromBmkg || LEVEL[bm].rank > 0 ? " DAN BMKG" : ""} · ${beach.toUpperCase()}*`,
		`${L.emoji} *${L.label}* — ${L.sub}`,
		...(strat ? [``, `*${strat.title}*`, strat.action] : []),
	];
	if (fin === "EKSTREM") {
		lines.push(``, `🛑 Nelayan dan BMKG sama-sama memberi peringatan bahaya. Jangan melaut.`);
		if (bmkgPart) lines.push(`⚠️ BMKG juga mengeluarkan peringatan: ${bmkgPart}.`);
	} else if (LEVEL[fin].rank > LEVEL[lik].rank) {
		lines.push(``, `ℹ️ Level ${L.label} karena ${bmkgPart ? `peringatan BMKG: ${bmkgPart}` : "kondisi cuaca BMKG"}. Pesan di atas tetap berlaku untuk tanda ini.`);
	}
	lines.push(
		``,
		`🌊 Tanda: ${p.codes.map(signLabel).join(", ")}`,
		`👥 Dilaporkan oleh ${p.reporterCount} nelayan · mulai ${wib(p.startedAt)}${p.endsAt ? ` · berlaku sampai ${wib(p.endsAt)}` : ""}`,
		``,
		`📱 Buka aplikasi SAMUDRA untuk peringatan khusus Anda.`,
	);
	return lines.join("\n");
}

/** Builds the group message from what the app will show now (active warning + current BMKG state). */
export async function groupAlertFor(beachLocation: string, alertEvent: Record<string, any>, startedAt: number): Promise<string> {
	const { getActiveWarning } = await import("./crowdsource");
	const { beachStatus } = await import("./map-status");
	const [aw, st] = await Promise.all([getActiveWarning(beachLocation).catch(() => null), beachStatus(beachLocation).catch(() => null)]);
	const ml = alertEvent.ml ?? {};
	return formatGroupAlert({
		beachLocation,
		codes: aw?.codes?.length ? aw.codes : (ml.active_warning ?? alertEvent.decision?.validatedSigns ?? []),
		likLevel: ml.lik_risk_level ?? alertEvent.riskLevel,
		finalLevel: st?.level ?? alertEvent.decision?.final_risk_level,
		strategyCode: ml.warning_strategy?.code ?? alertEvent.decision?.warning_strategy,
		bmkgLevel: st?.bmkg?.level,
		bmkgWarnings: st?.bmkg?.warnings ?? [],
		reporterCount: Number(alertEvent.reporterCount) || 1,
		startedAt,
		endsAt: aw?.expiresAt ?? null,
	});
}
