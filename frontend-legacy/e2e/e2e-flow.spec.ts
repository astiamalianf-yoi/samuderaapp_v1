import { test, expect } from "@playwright/test";
import { seedReportsUntilAlert, resetBeachQueues } from "./fixtures/seed-reports";

const API_BASE = "http://localhost:3000/api";

test.describe("End-to-End: Report → SHAP Predict → Alert → Display", () => {
	test.beforeEach(async () => {
		await resetBeachQueues("pantai_lampuuk");
	});

	test("full flow: 5 reports trigger alert visible on homepage", async ({ page }) => {
		const result = await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);
		expect(result.alertOk).toBe(true);
		expect(result.alertEvent).toBeDefined();

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		const alertCards = page.locator(".border-l-4");
		await expect(alertCards.first()).toBeVisible({ timeout: 10000 });
		expect(await alertCards.count()).toBeGreaterThan(0);
	});

	test("alert card shows beach name in heading", async ({ page }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		await expect(page.locator("h3").filter({ hasText: "Lampuuk" })).toBeVisible({ timeout: 10000 });
	});

	test("alert card shows reporter count", async ({ page }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		const alertCards = page.locator(".border-l-4");
		await expect(alertCards.first()).toBeVisible({ timeout: 10000 });
		await expect(page.getByText(/nelayan/)).toBeVisible({ timeout: 5000 });
	});

	test("alert card shows pantauan time range", async ({ page }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		await expect(page.getByText("Pantauan:")).toBeVisible({ timeout: 10000 });
	});

	test("alert card shows triggered LIK code label", async ({ page }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		const alertCards = page.locator(".border-l-4");
		await expect(alertCards.first()).toBeVisible({ timeout: 10000 });
		const likSection = page.locator("text=Tanda Alam Terdeteksi");
		await expect(likSection).toBeVisible({ timeout: 5000 });
	});

	test("alert card shows action recommendation from SHAP", async ({ page }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		await page.goto("/");
		await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
		await page.waitForTimeout(2000);

		await expect(page.getByText("Rekomendasi Aksi:")).toBeVisible({ timeout: 10000 });
	});

	test("GET /alerts returns correct fields from backend", async ({ request }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		const res = await request.get(`${API_BASE}/alerts?limit=5`);
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);

		const alert = body.data[0];
		expect(alert).toHaveProperty("alertId");
		expect(alert).toHaveProperty("beachLocation");
		expect(alert).toHaveProperty("riskLevel");
		expect(alert).toHaveProperty("reporterCount");
		expect(alert).toHaveProperty("firstReportAt");
		expect(alert).toHaveProperty("lastReportAt");
		expect(alert).toHaveProperty("signDescription");
		expect(alert).toHaveProperty("actionRecommendation");
		expect(alert).toHaveProperty("triggeredCodes");
		expect(alert).toHaveProperty("serverTimestamp");
	});

	test("riskLevel is derived correctly from SHAP response", async ({ request }) => {
		await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);

		const res = await request.get(`${API_BASE}/alerts?limit=5`);
		const body = await res.json();
		const alert = body.data[0];

		expect(["safe", "unsafe", "unsafe-high"]).toContain(alert.riskLevel);
	});

	test("POST /report returns queued status before threshold", async ({ request }) => {
		await resetBeachQueues("pantai_lhoknga");

		const res = await request.post(`${API_BASE}/report`, {
			data: {
				beach_location: "pantai_lhoknga",
				lik_codes: ["wn-1"],
				channel: "test",
				clientReportId: crypto.randomUUID(),
				createdAtClient: Date.now(),
			},
		});
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("queued");
	});

	test("POST /report returns alert after threshold", async ({ request }) => {
		const result = await seedReportsUntilAlert("pantai_lampuuk", ["wn-3"], 5);
		expect(result.alertOk).toBe(true);
	});
});
