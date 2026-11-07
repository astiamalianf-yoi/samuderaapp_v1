import { and, eq, gte, sql } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports } from "../db/schema";
import { Hono } from "hono";
import { findFishermanByToken, registerFisherman, toPublic, updateFisherman } from "../lib/fishermen";
import { loadActivity } from "../lib/adaptive-profile";
import { recordClass } from "../lib/class-history";

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
	if (row) void recordClass(row, res.created ? "registration" : "re-registration");
	return c.json({ ok: true, fisherman: res.fisherman, token: res.token, created: res.created }, res.created ? 201 : 200);
});

/** GET /api/fishermen/me (X-Fisherman-Token) */
route.get("/fishermen/me", (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	// His own activity is shown to him; the model category is not (researchers only).
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
	return c.json({ ok: true, fisherman: toPublic(f), activity: { ...loadActivity(f.id), channels_30d: { app, whatsapp } } });
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
	if (row) void recordClass(row, "profile-update");
	return c.json({ ok: true, fisherman: res.fisherman });
});

export default route;
