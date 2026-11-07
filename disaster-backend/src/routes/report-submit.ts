import { holdForRegistration } from "../lib/wa-sync";
import { trustTiersFor } from "../lib/trust-index";
import { Hono } from "hono";
import { riskLabelFor } from "../lib/whatsapp-commands";
import { redis } from "../lib/redis";
import { sendOpenClawBeachAlert } from "../lib/openclaw";
import { findFishermanByPhone, fishermanReporterKey } from "../lib/fishermen";
import { logFishermanReport } from "../lib/adaptive-profile";
import { recordClass } from "../lib/class-history";
import { processReport, getActiveWarning, setActiveWarning, getReportTimeRange, resetQueues, reporterKeyFor, countReporters } from "../lib/crowdsource";
import { persistReport, persistShapPrediction } from "../lib/bmkg";
import { reassure } from "../lib/reassurance";
import { publishIotAlertForEvent } from "../lib/iot-mqtt";
import {
	ALERTS_CHANNEL,
	ALERTS_STREAM,
	ML_BASE_URL,
	INTERNAL_REQUEST_SECRET,
	REPORT_SYNC_STREAM,
	REPORT_WINDOW_MS,
	REPORT_REPEAT_WINDOW_MS,
	REPORT_THRESHOLD,
	BEACH_THRESHOLDS,
	ACTIVE_WARNING_TTL_SECONDS,
} from "../config";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { likRiskLevel, type MlResult } from "../types";

const route = new Hono();

route.get("/report/submit", async (c) => {
	const beachLocation = c.req.query("beach_location")?.trim().toLowerCase();
	const likCodesStr = c.req.query("lik_codes")?.trim();
	const createdAtClientRaw = c.req.query("created_at_client");
	const channel = c.req.query("channel") || "PWA";
	// Who sent it: WhatsApp sender number (channel=WA) or the app's device id.
	// The WhatsApp number is trusted only from our own webhook (internal header); from the public
	// URL it is ignored, so nobody can file reports in a registered fisherman's name.
	const trustedSender = c.req.header("X-Internal-Key") === INTERNAL_REQUEST_SECRET;
	const reporterRaw = trustedSender ? c.req.query("reporter")?.trim().slice(0, 100) || null : null;

	if (!beachLocation) {
		return c.json({ ok: false, error: "beach_location query parameter required" }, 400);
	}

	if (!ALLOWED_BEACH_LOCATIONS.includes(beachLocation as (typeof ALLOWED_BEACH_LOCATIONS)[number])) {
		return c.json(
			{ ok: false, error: `beach_location must be one of: ${ALLOWED_BEACH_LOCATIONS.join(", ")}` },
			400,
		);
	}

	if (!likCodesStr) {
		return c.json({ ok: false, error: "lik_codes query parameter required" }, 400);
	}

	const lik_codes = likCodesStr
		.split(",")
		.map((code) => code.trim())
		.filter(Boolean);

	if (lik_codes.length === 0) {
		return c.json({ ok: false, error: "lik_codes must contain at least one code" }, 400);
	}

	let createdAtClient: number | undefined;
	if (createdAtClientRaw) {
		const parsed = Number(createdAtClientRaw);
		if (Number.isFinite(parsed) && parsed > 0) {
			createdAtClient = parsed;
		}
	}

	const isWA = channel === "WA";
	const normalizedChannel = isWA ? "WHATSAPP" : channel;

	const serverTimestamp = Date.now();
	const reportId = crypto.randomUUID();
	const threshold = BEACH_THRESHOLDS[beachLocation] ?? REPORT_THRESHOLD;

	// A registered WhatsApp number is the same person as his app reports ("fisher:<id>").
	const registered = isWA ? findFishermanByPhone(reporterRaw) : null;
	const reporterKey = registered
		? fishermanReporterKey(registered)
		: reporterKeyFor(isWA ? { waSender: reporterRaw } : { deviceId: reporterRaw });
	const { triggeredCodes, codeCounts, duplicateCodes } = await processReport(
		beachLocation,
		lik_codes,
		REPORT_WINDOW_MS,
		threshold,
		reporterKey,
		REPORT_REPEAT_WINDOW_MS,
	);
	const counted = (duplicateCodes ?? []).length < lik_codes.length;
	let heldForRegistration = false;
	if (registered) {
		logFishermanReport(registered.id, beachLocation, lik_codes, isWA ? "WHATSAPP" : channel, counted);
		void recordClass(registered, "report");
	} else if (isWA) {
		// Not registered yet: kept under his hashed number and added to his history when he registers.
		heldForRegistration = holdForRegistration(reporterRaw, "report", beachLocation, { signs: lik_codes, counted });
	}

	await redis.xAdd(REPORT_SYNC_STREAM, "*", {
		json: JSON.stringify({
			status: "RECEIVED_VIA_GET",
			channel: normalizedChannel,
			beachLocation,
			lik_codes,
			createdAtClient: createdAtClient ?? null,
			receivedAtServer: serverTimestamp,
			reportId,
			reporterKey,
			duplicateCodes,
		}),
	});

	if (triggeredCodes.length === 0) {
		return c.json({
			ok: true,
			reportId,
			serverTimestamp,
			status: "queued",
			message: "Laporan diterima. Menunggu laporan lain untuk mencapai threshold.",
			reportCounts: codeCounts,
			threshold,
			duplicateCodes,
			registered: Boolean(registered),
			heldForRegistration,
		});
	}

	const existingWarning = await getActiveWarning(beachLocation);

	const mlPayload = {
		lik_codes: triggeredCodes,
		beach_location: beachLocation,
		is_active_warning: existingWarning !== null,
		active_warning: existingWarning?.codes ?? [],
		trust_tiers: trustTiersFor(beachLocation),
	};

	const mlRes = await fetch(`${ML_BASE_URL}/predict`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(mlPayload),
	});

	if (!mlRes.ok) {
		const detail = await mlRes.text().catch(() => "");
		return c.json(
			{ ok: false, error: "ML /predict failed", status: mlRes.status, detail },
			502,
		);
	}

	const result = (await mlRes.json()) as MlResult;

	let reassuranceResult: Record<string, unknown> | null = null;
	try {
		const savedReport = await persistReport({
			beachLocation,
			reporterId: registered?.id ?? null,
			source: normalizedChannel,
			naturalSigns: triggeredCodes,
			rawBody: { beach_location: beachLocation, lik_codes, createdAtClient, _channel: channel },
		});
		const savedPrediction = await persistShapPrediction({
			reportId: savedReport.id,
			riskLevel: result.lik_risk_level ?? result.community_characteristics ?? "Unknown",
			communityCharacteristics: result.community_characteristics,
			validatedSigns: result.triggered_lik_codes ?? triggeredCodes,
			actions: result.action_recommendation ? [result.action_recommendation] : [],
			rawResponse: result as unknown as Record<string, unknown>,
		});
		const reassured = await reassure(savedPrediction.id, savedReport.id, {
			riskLevel: result.lik_risk_level ?? result.community_characteristics ?? "Unknown",
			communityCharacteristics: result.community_characteristics,
			validatedSigns: result.triggered_lik_codes ?? triggeredCodes,
			actions: result.action_recommendation ? [result.action_recommendation] : [],
			rawResponse: result as unknown as Record<string, unknown>,
		}, beachLocation);
		reassuranceResult = reassured as unknown as Record<string, unknown>;
	} catch (dbErr) {
		console.error("[report-submit] SQLite persistence failed (non-blocking, alert still distributed via fail-safe level):", dbErr);
	}

	const isMultisign = triggeredCodes.length > 1;
	const isActionable = result.community_characteristics === "Actionable";
	// Fail safe if fusion/persistence failed: escalate actionable signs rather than
	// silently downgrading to NORMAL (which would suppress the alert and the buzzer).
	const reassuranceFinalLevel =
		(reassuranceResult?.finalLevel as string) ??
		likRiskLevel(result, isMultisign);
	const riskLevel = reassuranceFinalLevel.toLowerCase();
	const reporterCount = await countReporters(beachLocation, triggeredCodes);
	const timeRange = await getReportTimeRange(beachLocation, triggeredCodes);

	const alertEvent = {
		eventType: "DISASTER_ALERT",
		alertId: crypto.randomUUID(),
		reportId,
		serverTimestamp,
		beachLocation,
		riskLevel,
		reporterCount,
		firstReportAt: timeRange.firstReportAt,
		lastReportAt: timeRange.lastReportAt,
		client: {
			clientReportId: null,
			createdAtClient: createdAtClient ?? null,
			userId: null,
			email: null,
		},
		decision: {
			community_characteristics: result.community_characteristics,
			warning_strategy: result.warning_strategy?.code ?? null,
			is_multisign: isMultisign,
			is_actionable: isActionable,
			final_risk_level: reassuranceFinalLevel,
			shouldDistribute: reassuranceFinalLevel !== "NORMAL",
		},
		input: mlPayload,
		ml: result,
		...(reassuranceResult && { reassurance: reassuranceResult }),
	};

	const mergedCodes = [...new Set([
		...(existingWarning?.codes ?? []),
		...result.active_warning,
	])];
	await setActiveWarning(beachLocation, mergedCodes, alertEvent.alertId, ACTIVE_WARNING_TTL_SECONDS, alertEvent);

	const alertJson = JSON.stringify(alertEvent);

	if (isWA) {
		await redis.xAdd("experiments:triggers", "*", {
			experimentId: "untagged",
			channel: normalizedChannel,
			triggeredAt: String(Date.now()),
			alertId: alertEvent.alertId,
		});
	}

	await redis.xAdd(ALERTS_STREAM, "*", { json: alertJson });

	console.log("[report-submit] publishing to Redis channel", ALERTS_CHANNEL, "channel:", normalizedChannel, "alertId:", alertEvent.alertId);
	await redis.publish(ALERTS_CHANNEL, alertJson);
	console.log("[report-submit] published OK");
	const iotResult = await publishIotAlertForEvent(alertEvent);
	if (iotResult.published) {
		console.log("[report-submit] published IoT MQTT alert", iotResult.topic);
	}

	if (isWA) {
		const riskLabel = riskLabelFor(alertEvent.riskLevel);
		const alertText = [
			`⚠️ PERINGATAN — ${riskLabel} di ${beachLocation.replace(/_/g, " ")}`,
			`👥 Dilaporkan oleh ${alertEvent.reporterCount} nelayan`,
			`Tanda: ${triggeredCodes.join(", ")}`,
			`Rekomendasi: ${alertEvent.ml?.action_recommendation ?? "Tidak ada rekomendasi"}`,
			"Peringatan sedang dikirim ke semua nelayan.",
		].join("\n");
		await sendOpenClawBeachAlert(beachLocation, alertText);
		console.log("[report-submit] sent WhatsApp alert broadcast");
	}

	await resetQueues(beachLocation, triggeredCodes);
	console.log("[report-submit] reset queues for", beachLocation, "codes:", triggeredCodes);

	return c.json({
		ok: true,
		reportId,
		serverTimestamp,
		status: "triggered",
		shouldDistribute: true,
		alertEvent,
		reportCounts: codeCounts,
		registered: Boolean(registered),
		heldForRegistration,
	});
});

export default route;
