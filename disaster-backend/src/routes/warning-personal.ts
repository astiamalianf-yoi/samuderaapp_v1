import { Hono } from "hono";
import { getActiveWarning } from "../lib/crowdsource";
import { computePersonalWarning, parseFishermanProfile } from "../lib/personal-warning";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { findFishermanByToken } from "../lib/fishermen";
import { currentEffectiveProfile } from "../lib/adaptive-profile";

const route = new Hono();

/**
 * POST /api/warning/personal { beach_location, fisherman_profile }
 * Personal warning strategy for the beach's active warning (no profile is stored).
 */
route.post("/warning/personal", async (c) => {
	const input = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!input) return c.json({ ok: false, error: "Invalid JSON" }, 400);

	const beach = typeof input.beach_location === "string" ? input.beach_location.trim().toLowerCase() : "";
	if (!ALLOWED_BEACH_LOCATIONS.includes(beach as (typeof ALLOWED_BEACH_LOCATIONS)[number])) {
		return c.json({ ok: false, error: `beach_location must be one of: ${ALLOWED_BEACH_LOCATIONS.join(", ")}` }, 400);
	}

	// A registered fisherman gets his adaptive profile (answers raised by his activity, age for
	// this year); otherwise the profile sent by the phone is used.
	const fisherman = findFishermanByToken(c.req.header("X-Fisherman-Token"));
	const profile = (fisherman && currentEffectiveProfile(fisherman)) || parseFishermanProfile(input.fisherman_profile);
	if (!profile) return c.json({ ok: false, error: "fisherman_profile is missing or out of range" }, 422);

	const active = await getActiveWarning(beach);
	if (!active || active.codes.length === 0) {
		return c.json({ ok: true, active: false });
	}

	const personal = await computePersonalWarning(beach, active.codes, profile, active.alertId).catch(() => null);
	if (!personal) {
		return c.json({ ok: false, active: true, alertId: active.alertId, error: "model service unavailable" }, 503);
	}

	return c.json({ ok: true, active: true, alertId: active.alertId, ...personal });
});

export default route;
