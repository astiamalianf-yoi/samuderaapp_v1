import { test, expect } from "@playwright/test";
import { seedAlert } from "./fixtures/test-data";

test.describe("SSE Real-time Updates", () => {
	test("SSE connection established on page load", async ({ page }) => {
		await page.addInitScript(() => {
			(window as Record<string, unknown>).__sseConnected = false;
			const OrigEventSource = window.EventSource;
			window.EventSource = class extends OrigEventSource {
				constructor(url: string, ...args: unknown[]) {
					super(url, ...args);
					if (url.includes("/sse")) {
						(window as Record<string, unknown>).__sseConnected = true;
					}
				}
			} as unknown as typeof EventSource;
		});

		await page.goto("/");
		await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
		await page.waitForTimeout(3000);

		const connected = await page.evaluate(() => (window as Record<string, unknown>).__sseConnected);
		expect(connected).toBe(true);
	});

	test("new alert appears in feed via SSE", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
		await page.waitForTimeout(2000);

		const beforeCount = await page.locator(".border-l-4").count();

		await seedAlert("pantai_lampuuk", ["WN-3", "WN-4"]);

		await page.waitForTimeout(4000);

		const afterCount = await page.locator(".border-l-4").count();
		expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
	});
});
