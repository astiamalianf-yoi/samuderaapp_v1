import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

const mockRedis = {
	hSet: mock<(hash: string, field: string, value: string) => Promise<number>>(),
	hDel: mock<(hash: string, field: string) => Promise<number>>(),
	hVals: mock<(hash: string) => Promise<string[]>>(),
	get: mock<(key: string) => Promise<string | null>>(async () => null),
	set: mock<(...args: unknown[]) => Promise<string>>(async () => "OK"),
};

mock.module("../lib/redis", () => ({
	redis: mockRedis,
}));

mock.module("../config", () => ({
	VAPID_SUBJECT: "mailto:test@example.com",
	VAPID_PUBLIC_KEY: "test-public-key",
	VAPID_PRIVATE_KEY: "test-private-key",
	PUSH_SUBSCRIPTIONS_HASH: "alerts:push:subscriptions",
	ML_BASE_URL: "http://ml.test",
}));

// web-push validates real VAPID keys in setVapidDetails; stub it out.
const sendNotification = mock(async (_sub: unknown, _payload: string, _opts?: unknown) => {});
mock.module("web-push", () => ({
	setVapidDetails: mock(() => {}),
	sendNotification,
}));

import pushRoute from "./push";
import { buildPushPayload, initWebPush, sendPushAlertToAll } from "../lib/push";

initWebPush(); // flips pushConfigured = true so routes are enabled

const app = new Hono().route("/api", pushRoute);

const validSub = {
	endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
	keys: { auth: "auth-secret", p256dh: "p256dh-key" },
};

describe("POST /api/push/subscribe", () => {
	beforeEach(() => {
		mockRedis.hSet.mockClear().mockResolvedValue(1);
		mockRedis.hDel.mockClear().mockResolvedValue(1);
	});

	test("accepts the frontend wrapped payload { subscription, beach_location }", async () => {
		const res = await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ subscription: validSub, beach_location: "all" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(mockRedis.hSet).toHaveBeenCalledTimes(1);
		expect(mockRedis.hSet).toHaveBeenCalledWith(
			"alerts:push:subscriptions",
			validSub.endpoint,
			expect.any(String),
		);
	});

	test("still accepts a raw PushSubscription payload (service-worker back-compat)", async () => {
		const res = await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(validSub),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(mockRedis.hSet).toHaveBeenCalledTimes(1);
	});

	test("rejects a payload with no usable subscription", async () => {
		const res = await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ beach_location: "all" }),
		});
		expect(res.status).toBe(400);
		expect(mockRedis.hSet).not.toHaveBeenCalled();
	});
});

const PROFILE = {
	age: 55, fishing_experience: 30, fishing_role: 3, head_of_community: 0, fishing_duration: 1,
	disaster_experience_count: 4, disaster_interaction: 1, lik_combination_count: 2,
	usage_duration: 8, usage_frequency_min: 2, usage_frequency_max: 4,
};

describe("push metadata and personalisation", () => {
	beforeEach(() => {
		mockRedis.hSet.mockClear().mockResolvedValue(1);
		sendNotification.mockClear();
	});

	test("stores beach and a valid fisherman profile with the subscription", async () => {
		const res = await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ subscription: validSub, metadata: { beach_location: "pantai_depok", fisherman_profile: PROFILE } }),
		});
		expect(res.status).toBe(200);
		const stored = JSON.parse(mockRedis.hSet.mock.calls[0]![2]);
		expect(stored.metadata.beach_location).toBe("pantai_depok");
		expect(stored.metadata.fisherman_profile.age).toBe(55);
	});

	test("drops an out-of-range profile but keeps the subscription", async () => {
		await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ subscription: validSub, metadata: { fisherman_profile: { ...PROFILE, fishing_role: 9 } } }),
		});
		const stored = JSON.parse(mockRedis.hSet.mock.calls[0]![2]);
		expect(stored.metadata).toBeUndefined();
	});

	test("payload is short Indonesian text with the strategy", () => {
		const p = buildPushPayload({ alertId: "a1", beachLocation: "pantai_depok", riskLevel: "siaga",
			ml: { action_recommendation: "Amankan alat tangkap.", warning_strategy: { label_id: "Peringatan Tambahan + Panduan Tindakan" } } });
		expect(p.title).toBe("SIAGA: Pantai Depok");
		expect(p.body).toContain("Peringatan Tambahan");
		expect(p.beach_location).toBe("pantai_depok");
	});

	test("skips other beaches and personalises subscribers with a profile", async () => {
		mockRedis.hVals.mockResolvedValue([
			JSON.stringify({ ...validSub, endpoint: "https://e/1", metadata: { beach_location: "pantai_lampuuk" } }),
			JSON.stringify({ ...validSub, endpoint: "https://e/2", metadata: { beach_location: "pantai_depok", fisherman_profile: PROFILE } }),
			JSON.stringify({ ...validSub, endpoint: "https://e/3" }),
		]);
		const realFetch = globalThis.fetch;
		globalThis.fetch = mock(async () => new Response(JSON.stringify({
			lik_risk_level: "SIAGA", action_recommendation: "Tunda melaut.",
			warning_strategy: { code: "MAXIMUM_ALERT", label_id: "Peringatan Maksimum + Intervensi" },
		}))) as unknown as typeof fetch;
		try {
			const result = await sendPushAlertToAll(JSON.stringify({
				alertId: "alert-1", beachLocation: "pantai_depok", riskLevel: "siaga",
				ml: { active_warning: ["Wn-5"], action_recommendation: "Pantau.", warning_strategy: { label_id: "Pantau Tanda Alam Lebih Lanjut" } },
			}));
			expect(result).toMatchObject({ sent: 2, skipped: 1, personalised: 1 });
			const bodies = sendNotification.mock.calls.map((c) => JSON.parse(c[1] as string));
			expect(bodies.some((b) => b.body.includes("Maksimum") && b.personal)).toBe(true);
			expect(bodies.some((b) => b.body.includes("Pantau") && !b.personal)).toBe(true);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});
