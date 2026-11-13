import { Hono } from "hono";
import { saveIncident } from "../lib/incident-store";
import { findFishermanByToken, normalizePhone } from "../lib/fishermen";
import { INCIDENT_TYPES, type IncidentType } from "../lib/adaptive-profile";
import { recordClass } from "../lib/class-history";
import { sendOpenClawBeachAlert } from "../lib/openclaw";
import { redis } from "../lib/redis";
import { BEACH_DISPLAY_NAMES } from "./report";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { tokenFrom } from "./fishermen";

const route = new Hono();

export const INCIDENT_LABEL: Record<IncidentType, string> = {
	angin_kencang: "Angin kencang di laut",
	gelombang_ekstrem: "Gelombang ekstrem",
	badai: "Badai / hujan lebat",
	arus_kuat: "Arus kuat",
};

/** One help message per fisherman per 10 minutes (taps repeated in panic are sent once). */
const HELP_COOLDOWN_SECONDS = 10 * 60;

const wib = (d = new Date()) =>
	new Intl.DateTimeFormat("id-ID", {
		timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
	}).format(d) + " WIB";

const showPhone = (digits: string) => `0${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;

/** WhatsApp group text for a help request. The number is used for this message only, never stored. */
/** Why a help request has no location: he chose not to share it, or the phone could not give one. */
export type LocationStatus = "not_shared" | "denied" | "unavailable";
const NO_LOCATION: Record<LocationStatus, string> = {
	not_shared: "🗺️ Lokasi tidak dibagikan",
	denied: "🗺️ Lokasi tidak terkirim: izin lokasi di HP ditolak",
	unavailable: "🗺️ Lokasi tidak terkirim: GPS HP belum mendapat posisi",
};

export function formatHelpMessage(o: { beach: string; type: IncidentType; lat?: number | null; lon?: number | null; phone?: string | null; at?: Date; locationStatus?: LocationStatus | null }) {
	const lines = [
		"🆘 *NELAYAN BUTUH BANTUAN*",
		`📍 ${BEACH_DISPLAY_NAMES[o.beach] ?? o.beach}`,
		`⚠️ ${INCIDENT_LABEL[o.type]}`,
		`🕐 ${wib(o.at)}`,
		o.lat != null && o.lon != null
			? `🗺️ Lokasi: https://maps.google.com/?q=${o.lat.toFixed(5)},${o.lon.toFixed(5)}`
			: NO_LOCATION[o.locationStatus ?? "not_shared"],
		o.phone ? `📞 Hubungi: ${showPhone(o.phone)} (WhatsApp)` : "📞 Nomor tidak dibagikan",
		"",
		"Yang terdekat mohon segera bantu. Darurat: Basarnas *115* atau *112*.",
	];
	return lines.join("\n");
}

const coord = (v: unknown, lim: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim ? v : null);

/**
 * POST /api/incidents { beach, type, needHelp, lat?, lon?, contactPhone? } (X-Fisherman-Token)
 * "Lapor kejadian": strong wind / storm adds to his level of interaction with disaster (codebook
 * No. 14); if he reported a sign before it, the hazard type counts as detected with LIK (No. 12).
 * A strong-wind or storm incident also confirms other fishermen's sign reports (Trust Index).
 * With needHelp, a help message goes to the WhatsApp group(s).
 */
route.post("/incidents", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return c.json({ ok: false, error: "Invalid JSON" }, 400);
	const fisherman = findFishermanByToken(tokenFrom(c.req.header("X-Fisherman-Token"), body));
	if (!fisherman) return c.json({ ok: false, error: "registration_required" }, 401);

	const beach = typeof body.beach === "string" ? body.beach : "";
	if (!(ALLOWED_BEACH_LOCATIONS as readonly string[]).includes(beach)) return c.json({ ok: false, error: "invalid_beach" }, 400);
	const type = body.type as IncidentType;
	if (!INCIDENT_TYPES.includes(type)) return c.json({ ok: false, error: "invalid_type" }, 400);
	const needHelp = body.needHelp === true;
	const lat = coord(body.lat, 90);
	const lon = coord(body.lon, 180);
	const locationStatus = (["not_shared", "denied", "unavailable"] as const).find((v) => v === body.locationStatus) ?? null;

	const row = saveIncident({ fishermanId: fisherman.id, beach, type, needHelp, lat, lon });

	let helpSent = false;
	let helpReason: string | null = null;
	if (needHelp) {
		const fresh = await redis
			.set(`incident:help:${fisherman.id}`, row.id, { NX: true, EX: HELP_COOLDOWN_SECONDS })
			.catch(() => "OK");
		if (fresh === "OK") {
			const phone = normalizePhone(typeof body.contactPhone === "string" ? body.contactPhone : null);
			await sendOpenClawBeachAlert(beach, formatHelpMessage({ beach, type, lat, lon, phone, locationStatus }))
				.then(() => { helpSent = true; })
				.catch(() => { helpReason = "whatsapp_unavailable"; });
		} else {
			helpReason = "already_sent";
		}
	}
	void recordClass(fisherman, "incident");
	return c.json({ ok: true, incidentId: row.id, helpSent, helpReason }, 201);
});

export default route;
