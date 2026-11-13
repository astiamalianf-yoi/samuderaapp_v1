import { findFishermanById } from "./fishermen";
import { currentEffectiveProfile } from "./adaptive-profile";
import {
	sendNotification,
	setVapidDetails,
	type PushSubscription,
} from "web-push";
import {
	PUSH_SUBSCRIPTIONS_HASH,
	VAPID_PRIVATE_KEY,
	VAPID_PUBLIC_KEY,
	VAPID_SUBJECT,
} from "../config";
import { redis } from "./redis";
import { computePersonalWarning, parseFishermanProfile, type FishermanProfile } from "./personal-warning";

/** Optional per-subscriber data sent by the PWA: chosen beach and fisherman profile. */
export type PushMetadata = {
	beach_location?: string;
	fisherman_profile?: FishermanProfile;
	/** Set by the server from the fisherman token at subscribe; his adaptive profile is used at send time. */
	fisherman_id?: string;
};

type StoredSubscription = PushSubscription & { metadata?: PushMetadata };

let pushConfigured = false;

export function initWebPush() {
	const hasAnyVapid = Boolean(VAPID_SUBJECT || VAPID_PUBLIC_KEY || VAPID_PRIVATE_KEY);
	const hasAllVapid = Boolean(VAPID_SUBJECT && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

	if (!hasAnyVapid) {
		console.warn("[push] VAPID env vars missing, push disabled");
		pushConfigured = false;
		return;
	}
	if (!hasAllVapid) {
		console.warn("[push] partial VAPID env vars found, push disabled");
		pushConfigured = false;
		return;
	}

	setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
	pushConfigured = true;
}

export function isPushConfigured() {
	return pushConfigured;
}

/** Registered fisherman: his adaptive profile now (it changes with his activity); else the phone's copy. */
function profileForSubscriber(metadata?: PushMetadata): FishermanProfile | null {
	if (metadata?.fisherman_id) {
		try {
			const f = findFishermanById(metadata.fisherman_id);
			const p = f && currentEffectiveProfile(f);
			if (p) return p;
		} catch {
			// database unavailable: fall back to the phone's copy
		}
	}
	return metadata?.fisherman_profile ?? null;
}

export function parsePushMetadata(input: unknown): PushMetadata | undefined {
	if (!input || typeof input !== "object") return undefined;
	const raw = input as Record<string, unknown>;
	const meta: PushMetadata = {};
	if (typeof raw.beach_location === "string" && raw.beach_location.trim()) {
		meta.beach_location = raw.beach_location.trim().toLowerCase();
	}
	const profile = parseFishermanProfile(raw.fisherman_profile);
	if (profile) meta.fisherman_profile = profile;
	return Object.keys(meta).length ? meta : undefined;
}

export async function savePushSubscription(subscription: PushSubscription, metadata?: PushMetadata) {
	const { endpoint, expirationTime, keys } = subscription as PushSubscription & { expirationTime?: number | null };
	const stored: StoredSubscription = { endpoint, keys, ...(expirationTime != null && { expirationTime }), ...(metadata && { metadata }) } as StoredSubscription;
	await redis.hSet(PUSH_SUBSCRIPTIONS_HASH, endpoint, JSON.stringify(stored));
}

export async function removePushSubscription(endpoint: string) {
	await redis.hDel(PUSH_SUBSCRIPTIONS_HASH, endpoint);
}

export async function listPushSubscriptions() {
	const rows = await redis.hVals(PUSH_SUBSCRIPTIONS_HASH);
	const subscriptions: StoredSubscription[] = [];
	for (const row of rows) {
		try {
			const parsed = JSON.parse(row) as StoredSubscription;
			if (parsed.endpoint && parsed.keys?.auth && parsed.keys?.p256dh) {
				subscriptions.push(parsed);
			}
		} catch {
			// skip malformed subscription rows
		}
	}
	return subscriptions;
}

export function isValidPushSubscription(input: unknown): input is PushSubscription {
	if (!input || typeof input !== "object") return false;
	const obj = input as PushSubscription;
	if (typeof obj.endpoint !== "string" || obj.endpoint.length === 0) return false;
	if (!obj.keys || typeof obj.keys !== "object") return false;
	if (typeof obj.keys.auth !== "string" || obj.keys.auth.length === 0) return false;
	if (typeof obj.keys.p256dh !== "string" || obj.keys.p256dh.length === 0) return false;
	return true;
}

const BEACH_LABEL: Record<string, string> = {
	pantai_lampuuk: "Pantai Lampuuk",
	pantai_lhoknga: "Pantai Lhoknga",
	pantai_ulee_lheue: "Pantai Ulee Lheue",
	pantai_depok: "Pantai Depok",
	pantai_samas: "Pantai Samas",
	pantai_pangandaran: "Pantai Pangandaran",
	pantai_batu_karas: "Pantai Batu Karas",
	pantai_bojongsalawe: "Pantai Bojongsalawe",
};

const LEVEL_WORD: Record<string, string> = { waspada: "WASPADA", siaga: "SIAGA", ekstrem: "BAHAYA", normal: "INFO" };

type AlertLike = {
	alertId?: string;
	beachLocation?: string;
	riskLevel?: string;
	ml?: { action_recommendation?: string; active_warning?: string[]; warning_strategy?: { label_id?: string } | null };
	input?: { beach_location?: string; lik_codes?: string[] };
};

/** Short Indonesian notification text; uses the subscriber's own strategy when known. */
export function buildPushPayload(
	alert: AlertLike,
	personal?: { warning_strategy?: { label_id?: string } | null; action_recommendation?: string } | null,
) {
	const beach = alert.beachLocation ?? alert.input?.beach_location ?? "";
	const level = LEVEL_WORD[(alert.riskLevel ?? "").toLowerCase()] ?? "PERINGATAN";
	const strategy = personal?.warning_strategy?.label_id ?? alert.ml?.warning_strategy?.label_id;
	const action = personal?.action_recommendation ?? alert.ml?.action_recommendation ?? "Buka aplikasi untuk detail.";
	return {
		type: "DISASTER_ALERT",
		title: `${level}: ${BEACH_LABEL[beach] ?? beach}`,
		body: [strategy, action].filter(Boolean).join(" — ").slice(0, 300),
		url: "/",
		tag: alert.alertId ? `alert-${alert.alertId}` : undefined,
		beach_location: beach,
		alertId: alert.alertId,
		personal: Boolean(personal?.warning_strategy),
	};
}

export async function sendPushAlertToAll(alertJson: string) {
	if (!pushConfigured) return { sent: 0, removed: 0, failed: 0, skipped: 0, personalised: 0 };

	let alertEvent: AlertLike;
	try {
		alertEvent = JSON.parse(alertJson) as AlertLike;
	} catch {
		return { sent: 0, removed: 0, failed: 0, skipped: 0, personalised: 0 };
	}

	const beach = alertEvent.beachLocation ?? alertEvent.input?.beach_location ?? "";
	const codes = alertEvent.ml?.active_warning ?? alertEvent.input?.lik_codes ?? [];
	const genericPayload = JSON.stringify(buildPushPayload(alertEvent));

	const subscriptions = await listPushSubscriptions();
	let sent = 0;
	let removed = 0;
	let failed = 0;
	let skipped = 0;
	let personalised = 0;

	for (const stored of subscriptions) {
		const { metadata, ...subscription } = stored;
		// Subscribers who chose another beach do not get this alert.
		if (metadata?.beach_location && metadata.beach_location !== "all" && beach && metadata.beach_location !== beach) {
			skipped += 1;
			continue;
		}

		let payload = genericPayload;
		const profile = profileForSubscriber(metadata);
		if (profile && alertEvent.alertId && codes.length) {
			const personal = await computePersonalWarning(beach, codes, profile, alertEvent.alertId).catch(() => null);
			if (personal?.warning_strategy) {
				payload = JSON.stringify(buildPushPayload(alertEvent, personal));
				personalised += 1;
			}
		}

		try {
			await sendNotification(subscription as PushSubscription, payload, {
				TTL: 60,
				urgency: "high",
				topic: typeof alertEvent.alertId === "string" ? alertEvent.alertId.replace(/-/g, "").slice(0, 32) : undefined,
			});
			sent += 1;
		} catch (err) {
			const statusCode = (err as { statusCode?: number }).statusCode;
			if (statusCode === 404 || statusCode === 410) {
				await removePushSubscription(subscription.endpoint);
				removed += 1;
				continue;
			}
			failed += 1;
		}
	}

	return { sent, removed, failed, skipped, personalised };
}
