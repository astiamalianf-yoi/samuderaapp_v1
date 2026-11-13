export const PORT = Number(process.env.PORT ?? 3000);
export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const DATABASE_URL = process.env.DATABASE_URL ?? "sqlite://./data/disaster.db";
export const ML_BASE_URL = process.env.ML_BASE_URL ?? "http://localhost:8000";

export const BMKG_CACHE_TTL_SECONDS = Number(process.env.BMKG_CACHE_TTL_SECONDS ?? 30 * 60);
export const BMKG_API_URL = process.env.BMKG_API_URL ?? "https://api.bmkg.go.id/publik/prakiraan-cuaca";

function parseBoolEnv(value: string | undefined, fallback: boolean) {
	if (value === undefined) return fallback;
	const normalized = value.trim().toLowerCase();
	if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
		return true;
	}
	if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
		return false;
	}
	return fallback;
}

export const ALERTS_CHANNEL = process.env.ALERTS_CHANNEL ?? "alerts:high";
export const ALERTS_STREAM = process.env.ALERTS_STREAM ?? "alerts:stream";
export const ACKS_STREAM = process.env.ACKS_STREAM ?? "alerts:acks";
export const REPORT_SYNC_STREAM = process.env.REPORT_SYNC_STREAM ?? "reports:sync";
export const REPORT_DEDUPE_PREFIX = process.env.REPORT_DEDUPE_PREFIX ?? "reports:dedupe";
export const REPORT_WINDOW_MS = Number(process.env.REPORT_WINDOW_MS ?? 24 * 60 * 60 * 1000);
// Reports of the same sign at one beach (from different fishermen, 24 h) that raise a community
// warning. 1 for now: one report is enough. Raise it with REPORT_THRESHOLD (all beaches) or per beach
// with REPORT_THRESHOLD_BEACHES, e.g. "pantai_lampuuk=3,pantai_lhoknga=5".
export const REPORT_THRESHOLD = Math.max(1, Number(process.env.REPORT_THRESHOLD ?? 1) || 1);
// Same reporter + same sign + same beach within this window counts as one report (app and WhatsApp alike).
// App reports need a registered fisherman (X-Fisherman-Token). WhatsApp reports are identified by the number.
export const REPORT_REQUIRE_REGISTRATION = (process.env.REPORT_REQUIRE_REGISTRATION ?? "true") !== "false";
export const REPORT_REPEAT_WINDOW_MS = Number(process.env.REPORT_REPEAT_WINDOW_MS ?? 5 * 60 * 1000);

export const BEACH_THRESHOLDS: Record<string, number> = Object.fromEntries(
	(process.env.REPORT_THRESHOLD_BEACHES ?? "")
		.split(",")
		.map((pair) => pair.split("=").map((x) => x.trim()))
		.filter(([beach, n]) => beach && Number(n) >= 1)
		.map(([beach, n]) => [beach, Math.floor(Number(n))]),
);
/**
 * How long a fishermen's (LIK) warning stays active on its own: 1 hour for every sign, until lead
 * times per sign are known (decided with the researcher, 14 Nov 2026). While an official BMKG
 * warning covers the beach, the LIK warning follows BMKG instead (lib/lik-duration.ts).
 */
export const ACTIVE_WARNING_TTL_SECONDS = Number(process.env.ACTIVE_WARNING_TTL_SECONDS ?? 60 * 60);

// Anonymous flood guard for /report (no auth required): max requests per IP per window.
export const REPORT_RATE_LIMIT_MAX = Number(process.env.REPORT_RATE_LIMIT_MAX ?? 15);
export const REPORT_RATE_LIMIT_WINDOW_SECONDS = Number(process.env.REPORT_RATE_LIMIT_WINDOW_SECONDS ?? 60);
export const PUSH_SUBSCRIPTIONS_HASH = process.env.PUSH_SUBSCRIPTIONS_HASH ?? "alerts:push:subscriptions";
export const ENABLE_SSE_DELIVERY = parseBoolEnv(process.env.ENABLE_SSE_DELIVERY, true);
export const ENABLE_WS_DELIVERY = parseBoolEnv(process.env.ENABLE_WS_DELIVERY, true);
export const ENABLE_PUSH_DELIVERY = parseBoolEnv(process.env.ENABLE_PUSH_DELIVERY, true);
export const ENABLE_IOT_MQTT_DELIVERY = parseBoolEnv(process.env.ENABLE_IOT_MQTT_DELIVERY, false);

function parseMqttQosEnv(value: string | undefined): 0 | 1 | 2 {
	const parsed = Number(value ?? 1);
	if (parsed === 0 || parsed === 1 || parsed === 2) return parsed;
	return 1;
}

export const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
export const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? "alert";
export const MQTT_QOS = parseMqttQosEnv(process.env.MQTT_QOS);
export const MQTT_RETAIN = parseBoolEnv(process.env.MQTT_RETAIN, false);
export const MQTT_ALARM_DURATION_MS = Number(process.env.MQTT_ALARM_DURATION_MS ?? 15000);
export const MQTT_PUBLISH_TIMEOUT_MS = Number(process.env.MQTT_PUBLISH_TIMEOUT_MS ?? 2000);
export const MQTT_USERNAME = process.env.MQTT_USERNAME ?? "";
export const MQTT_PASSWORD = process.env.MQTT_PASSWORD ?? "";

export const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

function parseCsvEnv(value: string | undefined, fallback: string[]) {
	if (!value) return fallback;
	const items = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return items.length > 0 ? items : fallback;
}

// CORS allowlist. The PWA calls /api same-origin via Next's proxy, so restricting
// to the frontend origins blocks cross-origin browser abuse without affecting users.
// Use "*" (single entry) to allow any origin.
export const CORS_ALLOWED_ORIGINS = parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS, [
	"https://www.samudraapp.com",
	"https://samudraapp.com",
	"http://localhost:3000",
	"http://localhost:3001",
]);

export const JWT_AUTH_ENABLED = parseBoolEnv(process.env.JWT_AUTH_ENABLED, false);
export const JWT_SECRET = process.env.JWT_SECRET ?? "";
export const JWT_EXPIRES_SECONDS = Number(process.env.JWT_EXPIRES_SECONDS ?? 86400);
export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "auth_token";
export const JWT_PUBLIC_PATHS = parseCsvEnv(process.env.JWT_PUBLIC_PATHS, [
	"/api/health",
	"/api/docs",
	"/api/openapi.json",
	"/api/push/vapid-public-key",
	"/api/auth/register",
	"/api/auth/login",
	"/api/report/submit",
	"/api/alerts",
	"/api/reports/active",
	"/api/broadcast/morning",
	"/api/bmkg",
	"/api/openclaw/webhook",
	"/api/warning/personal",
	"/api/fishermen",
	"/api/incidents",
	"/api/research",
	"/api/trust-index",
]);
export const AUTH_USER_KEY_PREFIX = process.env.AUTH_USER_KEY_PREFIX ?? "auth:user";
export const AUTH_USER_EMAIL_KEY_PREFIX =
	process.env.AUTH_USER_EMAIL_KEY_PREFIX ?? "auth:user:email";
export const AUTH_USER_IDENTITY_KEY_PREFIX =
	process.env.AUTH_USER_IDENTITY_KEY_PREFIX ?? "auth:user:identity";

export const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "";
export const OPENCLAW_HOOK_TOKEN = process.env.OPENCLAW_HOOK_TOKEN ?? "";
export const OPENCLAW_BROADCAST_GROUPS = parseCsvEnv(process.env.OPENCLAW_BROADCAST_GROUPS, []);
/**
 * One WhatsApp group per beach: "pantai_lhoknga=1203…@g.us,pantai_ulee_lheue=1203…@g.us".
 * When set, a beach's warnings go ONLY to its own group(s) (neighbouring beaches never see them);
 * a beach without a group gets no WhatsApp message. When empty, everything goes to
 * OPENCLAW_BROADCAST_GROUPS as before.
 */
export const OPENCLAW_BEACH_GROUPS: Record<string, string[]> = (() => {
	const out: Record<string, string[]> = {};
	for (const pair of parseCsvEnv(process.env.OPENCLAW_BEACH_GROUPS, [])) {
		const [beach, group] = pair.split("=").map((s) => s.trim());
		if (beach && group) (out[beach] ??= []).push(group);
	}
	return out;
})();
export const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY ?? "";

if (JWT_AUTH_ENABLED && !JWT_SECRET) {
	throw new Error("JWT_AUTH_ENABLED=true requires JWT_SECRET to be set");
}
if (!Number.isFinite(JWT_EXPIRES_SECONDS) || JWT_EXPIRES_SECONDS <= 0) {
	throw new Error("JWT_EXPIRES_SECONDS must be a positive number");
}

// BMKG short-term warnings (peringatan dini cuaca, CAP via RSS)
export const BMKG_NOWCAST_ENABLED = (process.env.BMKG_NOWCAST_ENABLED ?? "true") !== "false";
export const BMKG_NOWCAST_INTERVAL_MINUTES = Number(process.env.BMKG_NOWCAST_INTERVAL_MINUTES ?? 10);
export const BMKG_NOWCAST_RSS_URL = process.env.BMKG_NOWCAST_RSS_URL ?? "https://www.bmkg.go.id/alerts/nowcast/id";

/**
 * Shared only between the WhatsApp webhook and /api/report/submit inside this process: a
 * "reporter" (WhatsApp number) is trusted only with this header, so nobody can file reports in a
 * registered fisherman's name through the public URL.
 */
export const INTERNAL_REQUEST_SECRET = process.env.INTERNAL_REQUEST_SECRET || crypto.randomUUID();
