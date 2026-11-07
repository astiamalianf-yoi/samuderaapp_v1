import { Hono } from "hono";
import { findFishermanByToken, registerFisherman, toPublic, updateFisherman } from "../lib/fishermen";

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
	return c.json({ ok: true, fisherman: res.fisherman, token: res.token, created: res.created }, res.created ? 201 : 200);
});

/** GET /api/fishermen/me (X-Fisherman-Token) */
route.get("/fishermen/me", (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	return c.json({ ok: true, fisherman: toPublic(f) });
});

/** PUT /api/fishermen/me { homeBeach?, profile? } (X-Fisherman-Token) */
route.put("/fishermen/me", async (c) => {
	const f = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	if (!f) return c.json({ ok: false, error: "registration_required" }, 401);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return c.json({ ok: false, error: "Invalid JSON" }, 400);
	const res = updateFisherman(f, body);
	if (!res.ok) return c.json({ ok: false, error: res.error, message: ERRORS[res.error] }, 422);
	return c.json({ ok: true, fisherman: res.fisherman });
});

export default route;
