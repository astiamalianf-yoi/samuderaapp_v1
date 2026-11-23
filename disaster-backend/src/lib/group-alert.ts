import { signLabel, BEACH_DISPLAY } from "./whatsapp-commands";
import { buildWarningMessage, strategyTraits, toWhatsAppText, type MsgLevel } from "./warning-message";
import { APP_URL, WHATSAPP_BOT_NUMBER } from "../config";

/**
 * The warning sent to a beach's WhatsApp group (and shown in the app to users who have not
 * registered): the agreed wording of 23 Nov 2026 (Warning Strategy Matrix, rows 1–15), built by
 * warning-message.ts from the community view of the beach (community strategy, LIK fused with BMKG now).
 */
const norm = (v: unknown): MsgLevel => {
	const s = String(v ?? "").toUpperCase();
	if (s === "BAHAYA" || s === "EKSTREM") return "EKSTREM";
	if (s === "SIAGA" || s === "HIGH") return "SIAGA";
	if (s === "WASPADA" || s === "MEDIUM") return "WASPADA";
	return "NORMAL";
};

/** wa.me link to the bot with LAPOR typed, and the app's Kejadian page. */
export const reportUrl = () => (WHATSAPP_BOT_NUMBER ? `wa.me/${WHATSAPP_BOT_NUMBER}?text=LAPOR` : null);
export const kejadianUrl = () => `${APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}/kejadian`;

export function formatGroupAlert(p: {
	beachLocation: string;
	/** All signs in the warning (earlier ones too); none for a BMKG-only message. */
	codes: string[];
	/** The fishermen's own level for the beach (ml.lik_risk_level); null when there is no LIK warning. */
	likLevel: unknown;
	/** The final level shown on the card (LIK fused with BMKG now). */
	finalLevel: unknown;
	strategyCode?: string | null;
	/** BMKG level from the forecast (wind/weather), without the official warning. */
	bmkgForecastLevel?: unknown;
	windKmh?: number | null;
	weather?: string | null;
	/** Forecast window with bad weather (from getBmkgData periodStart/periodEnd). */
	bmkgPeriod?: { start: number; end: number } | null;
	bmkgWarnings?: { event?: string; expires?: number | null; effective?: number | null }[];
	reporterCount: number;
	startedAt: number;
	endsAt?: number | null;
	now?: number;
}): string {
	const beach = BEACH_DISPLAY[p.beachLocation] ?? p.beachLocation;
	const w0 = (p.bmkgWarnings ?? []).find((w) => w.event);
	const hasLik = p.likLevel != null && norm(p.likLevel) !== "NORMAL" && p.codes.length > 0;
	const traits = strategyTraits(p.strategyCode);
	const blocks = buildWarningMessage({
		beach,
		final: norm(p.finalLevel),
		lik: hasLik ? {
			level: norm(p.likLevel),
			signs: p.codes.map(signLabel).join(", "),
			reporters: Math.max(1, p.reporterCount || 1),
			highTrust: traits.highTrust,
			inaction: traits.inaction,
			startedAt: p.startedAt,
			endsAt: p.endsAt ?? null,
		} : null,
		bmkg: {
			official: w0 ? { event: w0.event!, expires: w0.expires ?? null, effective: w0.effective ?? null } : null,
			forecastLevel: norm(p.bmkgForecastLevel),
			windKmh: p.windKmh ?? null,
			weather: p.weather ?? null,
			period: p.bmkgPeriod ?? null,
		},
		channel: "wa",
		now: p.now,
		reportUrl: reportUrl(),
		kejadianUrl: kejadianUrl(),
	});
	return toWhatsAppText(blocks);
}

/** Forecast-only BMKG level, same limits as map-status (wind >= 46 SIAGA, >= 30 or bad weather WASPADA). */
const forecastLevel = (wind?: number | null, weather?: string | null, unsafe?: boolean): MsgLevel =>
	wind != null && wind >= 46 ? "SIAGA" : (wind != null && wind >= 30) || unsafe ? "WASPADA" : "NORMAL";

/**
 * The group message for a beach as the app shows it now (active LIK warning + current BMKG state).
 * alertEvent: the event that triggered it (LIK report); omitted for a BMKG warning.
 * Records the warning so the one-time AMAN message can follow when it ends.
 */
export async function groupMessageFor(beachLocation: string, alertEvent: Record<string, any> | null = null, startedAt?: number): Promise<string> {
	const { getActiveWarning } = await import("./crowdsource");
	const { beachStatus } = await import("./map-status");
	const { getBmkgData } = await import("./bmkg-fetch");
	const { markWarned } = await import("./all-clear");
	const [aw, st, fc] = await Promise.all([
		getActiveWarning(beachLocation).catch(() => null),
		beachStatus(beachLocation).catch(() => null),
		getBmkgData(beachLocation).catch(() => null),
	]);
	const ev = (alertEvent ?? (aw?.alertEvent as Record<string, any> | undefined) ?? null) as Record<string, any> | null;
	const ml = ev?.ml ?? {};
	const distributed = aw ? ((aw.alertEvent as any)?.decision?.shouldDistribute ?? true) : !!alertEvent;
	const lik = distributed && (aw || alertEvent) ? (ml.lik_risk_level ?? ev?.riskLevel ?? null) : null;
	const final = st?.level ?? ev?.decision?.final_risk_level ?? "NORMAL";
	const text = formatGroupAlert({
		beachLocation,
		codes: lik ? (aw?.codes?.length ? aw.codes : (ml.active_warning ?? ev?.decision?.validatedSigns ?? [])) : [],
		likLevel: lik,
		finalLevel: final,
		strategyCode: ml.warning_strategy?.code ?? ev?.decision?.warning_strategy,
		bmkgForecastLevel: forecastLevel(fc?.windSpeed, fc?.weather, fc ? !fc.isSafe : false),
		windKmh: fc?.windSpeed ?? st?.bmkg?.windSpeed ?? null,
		weather: fc?.weather ?? null,
		bmkgPeriod: fc?.periodStart && fc?.periodEnd ? { start: fc.periodStart, end: fc.periodEnd } : null,
		bmkgWarnings: st?.bmkg?.warnings ?? [],
		reporterCount: aw?.reporters?.length || Number(ev?.reporterCount) || 1,
		startedAt: startedAt ?? aw?.triggeredAt ?? Date.now(),
		endsAt: aw?.expiresAt ?? null,
	});
	await markWarned(beachLocation, norm(final)).catch(() => undefined);
	return text;
}

/** Builds the group message for a fishermen's warning (report from the app or from !lapor). */
export async function groupAlertFor(beachLocation: string, alertEvent: Record<string, any>, startedAt: number): Promise<string> {
	return groupMessageFor(beachLocation, alertEvent, startedAt);
}
