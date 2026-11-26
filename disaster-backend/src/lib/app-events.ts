import { initDb as getDb } from "../db";
import { appEvents } from "../db/schema";

/**
 * Usage log for the field study (Paper 4, RQ4): which registered fisherman used SAMUDRA on which day,
 * and how (26 Nov 2026). No message contents and no phone numbers; one row per fisherman, event,
 * WIB day and ref, so repeated opens on one day are one row.
 */
export const APP_EVENTS = ["app_open", "warning_seen", "why_open", "push_click"] as const;
/** Logged by the server only: wa_command (bot), push_sent (a warning push accepted by the push service). */
export type AppEvent = (typeof APP_EVENTS)[number] | "wa_command" | "push_sent";

/**
 * Where it happened: the app, a beach WhatsApp group or a private chat with the bot.
 * fishermanId is the registered fisherman, or for people who are not registered
 * "anon-wa:<keyed hash of the number>" (WhatsApp) or "anon-app:<random id of the phone>" (app).
 */
export type Channel = "APP" | "WA_GROUP" | "WA_PRIVATE";
export const anonWaId = (hash: string) => `anon-wa:${hash}`;
export const anonAppId = (deviceId: string) => `anon-app:${deviceId}`;
export const ANON_DEVICE_ID = /^[a-z0-9-]{8,40}$/i;

/** The WIB calendar day (UTC+7) of a moment, "YYYY-MM-DD". */
export function wibDay(at = Date.now()): string {
	return new Date(at + 7 * 3600_000).toISOString().slice(0, 10);
}

export function recordEvent(e: {
	fishermanId: string; event: AppEvent; ref?: string; beach?: string | null; channel: Channel; at?: number;
}): boolean {
	const ref = String(e.ref ?? "").slice(0, 120);
	const res = getDb().insert(appEvents)
		.values({ fishermanId: e.fishermanId, event: e.event, ref, beach: e.beach ?? null, channel: e.channel, day: wibDay(e.at) })
		.onConflictDoNothing()
		.run() as unknown as { changes?: number };
	return (res?.changes ?? 0) > 0;
}
