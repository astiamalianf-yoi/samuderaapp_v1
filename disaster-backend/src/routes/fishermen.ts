import { and, eq, gte, sql } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports } from "../db/schema";
import { Hono } from "hono";
import { deleteFishermanIdentity, findFishermanByToken, registerFisherman, toPublic, updateFisherman } from "../lib/fishermen";
import { currentEffectiveProfile, loadActivity } from "../lib/adaptive-profile";
import { classIsStale, profileView, profileViewEnabled } from "../lib/profile-view";
import { recordClass } from "../lib/class-history";
import { saveIncident } from "../lib/incident-store";
import { answerCrossCheck, answerFollowup, crossCheckFor, pendingFollowup } from "../lib/report-followup";
import { ANON_DEVICE_ID, APP_EVENTS, anonAppId, recordEvent, wibDay } from "../lib/app-events";
import { getClientIp } from "../lib/rate-limit";
import { redis } from "../lib/redis";
import { ALLOWED_BEACH_LOCATIONS } from "../types";

const route = new Hono();

const ERRORS: Record<string, string> = {
	invalid_phone: "Nomor WhatsApp tidak valid",
	invalid_beach: "Pantai asal tidak dikenal",
	invalid_profile: "Jawaban profil belum lengkap atau di luar batas",
	consent_required: "Persetujuan diperlukan",
};

/** Token from the app: header X-Fisherman-Token (or body.fishermanToken for queued offline reports). */
export const tokenFrom = (header: string | undefined, body?: Record<string, unknown> | null) =>
	header || (typeof body?.fishermanToken === "string" ? body.fishermanToken : null);

/**
 * POST /api/fishermen/register { phone, homeBeach, profile, consent: true }
 * -> { ok, fisherman: { id, phoneLast4, homeBeach, profile }, token }
 * Registering the same number again updates the fisherman and issues a new token.
 */
route.post("/fishermen/register", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return c.json({ ok: false, error: "Invalid JSON" }, 400);
	const res = await registerFisherman(body);
	if (!res.ok) return c.json({ ok: false, error: res.error, message: ERRORS[res.error] }, 422);
	const row = findFishermanByToken(res.token);
	if (row) await recordClass(row, res.created ? "registration" : "re-registration");
	return c.json({ ok: true, fisherman: res.fisherman, token: res.token, created: res.created }, res.created ? 201 : 200);
});

/** GET /api/fishermen/me (X-Fisherman-Token) */
route.get("/fishermen/me", async (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	// His own activity is shown to him. The model category is shown only as colours ("Profil Anda"),
	// unless PROFILE_CLASS_VISIBLE=false.
	// Where his reports of the last 30 days came from, so he can see WhatsApp reports count too.
	const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
	const channels = getDb()
		.select({ channel: fishermanReports.channel, n: sql<number>`count(*)` })
		.from(fishermanReports)
		.where(and(eq(fishermanReports.fishermanId, f.id), gte(fishermanReports.createdAt, since)))
		.groupBy(fishermanReports.channel)
		.all();
	const whatsapp = channels.filter((r) => r.channel === "WHATSAPP").reduce((n, r) => n + Number(r.n), 0);
	const app = channels.filter((r) => r.channel !== "WHATSAPP").reduce((n, r) => n + Number(r.n), 0);
	const effective = currentEffectiveProfile(f);
	// Catch up a class that is behind his current profile, but never keep the page waiting long.
	if (profileViewEnabled() && classIsStale(f.id, effective))
		await Promise.race([recordClass(f, "catch-up"), new Promise((r) => setTimeout(r, 3000))]);
	const view = profileView(f.id, effective);
	return c.json({
		ok: true,
		fisherman: toPublic(f),
		activity: { ...loadActivity(f.id), channels_30d: { app, whatsapp } },
		...(view ? { profile_view: view } : {}),
	});
});

/**
 * DELETE /api/fishermen/me (X-Fisherman-Token): "Hapus data saya". His identity, answers and class
 * history are deleted; his reports and incidents stay as anonymous rows (lib/fishermen.ts).
 */
route.delete("/fishermen/me", (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	deleteFishermanIdentity(f);
	console.log("[fishermen] identity deleted at his request:", f.id);
	return c.json({ ok: true, deleted: true });
});

/**
 * GET /api/fishermen/me/followup (X-Fisherman-Token): the two Beranda questions after his own sign
 * report of the last 24 h (app or WhatsApp). { pending: null } when there is nothing to ask.
 */
route.get("/fishermen/me/followup", (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	// The others of his home beach: "angin kencang datang?" after someone else's sign report.
	return c.json({ ok: true, pending: pendingFollowup(f.id), crosscheck: crossCheckFor(f.id, f.homeBeach) });
});

/** POST /api/fishermen/me/followup { reportId, kind: "response" | "hazard", value } (X-Fisherman-Token) */
route.post("/fishermen/me/followup", async (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	const kind = body?.kind;
	if (kind === "crosscheck") {
		// One tap: "Ya, ada" is saved as a strong-wind incident at his beach (it answers the question
		// and confirms the others' signs in the Trust Index); "Tidak ada" is saved as an answer.
		const value = body?.value;
		if (value !== "came" && value !== "not_came") return c.json({ ok: false, error: "invalid_value" }, 400);
		if (!crossCheckFor(f.id, f.homeBeach)) return c.json({ ok: false, error: "no_question" }, 409);
		if (value === "came") {
			saveIncident({ fishermanId: f.id, beach: f.homeBeach, type: "angin_kencang", channel: "APP" });
			void recordClass(f, "incident");
		} else answerCrossCheck({ fishermanId: f.id, beach: f.homeBeach, channel: "APP" });
		return c.json({ ok: true, pending: pendingFollowup(f.id), crosscheck: crossCheckFor(f.id, f.homeBeach) });
	}
	if (kind !== "response" && kind !== "hazard") return c.json({ ok: false, error: "invalid_kind" }, 400);
	// One tap: "Ya, datang" is saved as a strong-wind incident at the beach of his report.
	if (kind === "hazard" && body?.value === "came") {
		const p = pendingFollowup(f.id);
		if (!p || !p.needHazard) return c.json({ ok: false, error: p ? "already_answered" : "no_report" }, 409);
		if (typeof body?.reportId === "number" && body.reportId !== p.reportId) return c.json({ ok: false, error: "stale_report" }, 409);
		saveIncident({ fishermanId: f.id, beach: p.beach, type: "angin_kencang", channel: "APP" });
		void recordClass(f, "incident");
		return c.json({ ok: true, pending: pendingFollowup(f.id), crosscheck: crossCheckFor(f.id, f.homeBeach) });
	}
	const res = answerFollowup({
		fishermanId: f.id, kind, value: String(body?.value ?? ""), channel: "APP",
		reportId: typeof body?.reportId === "number" ? body.reportId : undefined,
	});
	if (!res.ok) return c.json(res, res.error === "invalid_value" ? 400 : 409);
	return c.json({ ...res, crosscheck: crossCheckFor(f.id, f.homeBeach) });
});

/**
 * POST /api/fishermen/me/events { event: app_open | warning_seen | why_open | push_click, ref?, beach? }
 * (X-Fisherman-Token): the usage log of the field study. Repeats on the same WIB day are one row.
 */
route.post("/fishermen/me/events", async (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	const event = body?.event;
	if (typeof event !== "string" || !(APP_EVENTS as readonly string[]).includes(event)) return c.json({ ok: false, error: "invalid_event" }, 400);
	const recorded = recordEvent({
		fishermanId: f.id, event: event as (typeof APP_EVENTS)[number], channel: "APP",
		ref: typeof body?.ref === "string" ? body.ref : "", beach: typeof body?.beach === "string" ? body.beach : f.homeBeach,
	});
	return c.json({ ok: true, recorded });
});

/**
 * POST /api/events/anon { deviceId, event, ref?, beach? }: the same usage log for people who use
 * the app without registering, under a random id kept on the phone (no number, no name).
 * At most 300 rows per IP and day, so the log cannot be flooded.
 */
route.post("/events/anon", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	const deviceId = body?.deviceId, event = body?.event;
	if (typeof deviceId !== "string" || !ANON_DEVICE_ID.test(deviceId)) return c.json({ ok: false, error: "invalid_device" }, 400);
	if (typeof event !== "string" || !(APP_EVENTS as readonly string[]).includes(event)) return c.json({ ok: false, error: "invalid_event" }, 400);
	const key = `anon-events:${getClientIp(c.req.header("x-forwarded-for"))}:${wibDay()}`;
	const n = await redis.incr(key).catch(() => 0);
	if (n === 1) await redis.expire(key, 2 * 24 * 3600).catch(() => undefined);
	if (n > 300) return c.json({ ok: false, error: "too_many" }, 429);
	const beach = typeof body?.beach === "string" && (ALLOWED_BEACH_LOCATIONS as readonly string[]).includes(body.beach) ? body.beach : null;
	const recorded = recordEvent({ fishermanId: anonAppId(deviceId), event: event as (typeof APP_EVENTS)[number], channel: "APP", ref: typeof body?.ref === "string" ? body.ref : "", beach });
	return c.json({ ok: true, recorded });
});

/** PUT /api/fishermen/me { homeBeach?, profile? } (X-Fisherman-Token) */
route.put("/fishermen/me", async (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return c.json({ ok: false, error: "Invalid JSON" }, 400);
	const res = updateFisherman(f, body);
	if (!res.ok) return c.json({ ok: false, error: res.error, message: ERRORS[res.error] }, 422);
	const row = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	// Awaited, so the Profil page opened right after saving shows the new class, not the old one.
	if (row) await recordClass(row, "profile-update");
	return c.json({ ok: true, fisherman: res.fisherman });
});

export default route;
