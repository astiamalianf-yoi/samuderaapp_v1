import { test, expect } from "@playwright/test";

async function waitForPage(page: import("@playwright/test").Page) {
	await page.goto("/");
	await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
	await page.waitForTimeout(1000);
}

test.describe("Alert Feed", () => {
	test("alert feed section is visible", async ({ page }) => {
		await waitForPage(page);
		const feed = page.locator("main").first();
		await expect(feed).toBeVisible();
		const hasAlerts = await page.locator(".border-l-4").count();
		const hasEmpty = await page.getByText("Belum ada peringatan saat ini").isVisible().catch(() => false);
		expect(hasAlerts > 0 || hasEmpty).toBe(true);
	});

	test("displays alerts from API", async ({ page }) => {
		const { seedAlert } = await import("./fixtures/test-data");
		await seedAlert("pantai_lampuuk", ["wn-3"]);
		await waitForPage(page);
		const alertCards = page.locator(".border-l-4");
		const count = await alertCards.count();
		expect(count).toBeGreaterThan(0);
	});

	test("each alert shows beach name", async ({ page }) => {
		const { seedAlert } = await import("./fixtures/test-data");
		await seedAlert("pantai_lhoknga", ["wn-4"]);
		await waitForPage(page);
		const beachLabel = page.getByText("Lhoknga");
		await expect(beachLabel).toBeVisible();
	});

	test("each alert shows risk badge", async ({ page }) => {
		const { seedAlert } = await import("./fixtures/test-data");
		await seedAlert("pantai_samas", ["wn-1"]);
		await waitForPage(page);
		const badge = page.locator("span").filter({ hasText: /^(Aman|Tidak Aman)$/ });
		await expect(badge.first()).toBeVisible();
	});

	test("each alert shows triggered LIK codes", async ({ page }) => {
		const { seedAlert } = await import("./fixtures/test-data");
		await seedAlert("pantai_depok", ["wn-3", "wn-4"]);
		await waitForPage(page);
		const alertCards = page.locator(".border-l-4");
		await expect(alertCards.first()).toBeVisible({ timeout: 10000 });
		const codes = page.locator(".border-l-4").getByText(/wn-/i);
		const codeCount = await codes.count();
		expect(codeCount).toBeGreaterThan(0);
	});

	test("shows action recommendation text", async ({ page }) => {
		const { seedAlert } = await import("./fixtures/test-data");
		await seedAlert("pantai_ulee_lheue", ["wn-3"]);
		await waitForPage(page);
		const alertCards = page.locator(".border-l-4");
		await expect(alertCards.first()).toBeVisible({ timeout: 10000 });
		const rec = page.locator(".border-l-4").getByText(/tindakan|laut|aman/i);
		await expect(rec.first()).toBeVisible();
	});
});
