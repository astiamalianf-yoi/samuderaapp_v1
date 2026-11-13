import { Hono } from "hono";
import { redis } from "../lib/redis";
import { ALERTS_STREAM } from "../config";

function deriveRiskLevel(decision: Record<string, unknown> | undefined): string {
	if (!decision) return "unknown";
	const isActionable = decision.community_characteristics === "Actionable";
	const isMultisign = decision.is_multisign === true;
	if (!isActionable) return "safe";
	return isMultisign ? "unsafe-high" : "unsafe";
}

const route = new Hono();

route.get("/alerts", async (c) => {
	const limitParam = Number(c.req.query("limit") ?? "20");
	const limit = Math.min(Math.max(limitParam, 1), 50);
	const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
	const minId = `${twentyFourHoursAgo}-0`;

	const events = await redis.xRange(ALERTS_STREAM, minId, "+", { COUNT: limit });

	if (!events || events.length === 0) {
		return c.json({ ok: true, data: [] });
	}

	const alerts = events.map((event) => {
		const fields = (event as unknown as { id: string; message: Record<string, string> }).message;
		const parsed = JSON.parse(fields.json ?? "{}") as Record<string, unknown>;
		const ml = parsed.ml as Record<string, unknown> | undefined;
		const decision = parsed.decision as Record<string, unknown> | undefined;
		const input = parsed.input as Record<string, unknown> | undefined;
		const ts = (parsed.serverTimestamp as number) ?? 0;
		if (ts < twentyFourHoursAgo) return null;

		return {
			alertId: (parsed.alertId as string) ?? "",
			beachLocation: (input?.beach_location as string) ?? "",
			riskLevel: (parsed.riskLevel as string)
				?? deriveRiskLevel(decision),
			reporterCount: (parsed.reporterCount as number) ?? 0,
			firstReportAt: (parsed.firstReportAt as number) ?? 0,
			lastReportAt: (parsed.lastReportAt as number) ?? 0,
			communityCharacteristics: (decision?.community_characteristics as string) ?? "",
			actionRecommendation: (ml?.action_recommendation as string) ?? "",
			signDescription: (ml?.sign_description as string) ?? "",
			triggeredCodes: ((ml?.triggered_lik_codes as string[]) ?? (input?.lik_codes as string[]) ?? []),
			explanation: ml?.explanation as Record<string, unknown> | undefined,
			serverTimestamp: ts,
			// BMKG nowcast events (bmkg-nowcast.ts) carry their source and validity, so "!peringatan"
			// can show them as BMKG warnings instead of a fishermen's report with 0 reporters.
			source: (parsed.source as string) ?? "LIK",
			bmkg: parsed.bmkg as Record<string, unknown> | undefined,
		};
	}).filter(Boolean);

	const sorted = alerts.reverse().slice(0, limit);
	return c.json({ ok: true, data: sorted });
});

route.get("/alerts/:id/explanation", async (c) => {
	const alertId = c.req.param("id");
	const events = await redis.xRange(ALERTS_STREAM, "-", "+", { COUNT: 1000 });

	if (!events || events.length === 0) {
		return c.json({ ok: false, error: "Alert not found" }, 404);
	}

	const target = (events as unknown as { id: string; message: Record<string, string> }[]).find((event) => {
		const parsed = JSON.parse(event.message.json ?? "{}") as Record<string, unknown>;
		return parsed.alertId === alertId;
	});

	if (!target) {
		return c.json({ ok: false, error: "Alert not found" }, 404);
	}

	const parsed = JSON.parse(target.message.json ?? "{}") as Record<string, unknown>;
	const ml = parsed.ml as Record<string, unknown> | undefined;
	const decision = parsed.decision as Record<string, unknown> | undefined;
	const input = parsed.input as Record<string, unknown> | undefined;
	const reassurance = parsed.reassurance as Record<string, unknown> | undefined;
	const explanation = ml?.explanation as Record<string, unknown> | undefined;

	return c.json({
		ok: true,
		data: {
			alertId: (parsed.alertId as string) ?? "",
			riskLevel: (parsed.riskLevel as string) ?? deriveRiskLevel(decision),
			beachLocation: (input?.beach_location as string) ?? "",
			summary_id: (explanation?.summary_id as string) ?? "",
			summary_en: (explanation?.summary_en as string) ?? "",
			contributions: (explanation?.contributions as unknown[]) ?? [],
			communityProfile: (explanation?.community_profile as unknown) ?? null,
			reassurance: reassurance ?? null,
			createdAt: (parsed.serverTimestamp as number)
				? new Date(parsed.serverTimestamp as number).toISOString()
				: null,
		},
	});
});

export default route;
