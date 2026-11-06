import { test, expect } from "@playwright/test";

test.describe("Weather Dashboard", () => {
	test("page loads and shows summary section", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
	});

	test("displays BMKG summary card", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText("BMKG", { exact: true }).first()).toBeVisible();
	});

	test("displays laporan warga card", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText("LAPORAN WARGA", { exact: false })).toBeVisible();
	});

	test("weather footer shows beach data", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText("Sumber Data: BMKG", { exact: false })).toBeVisible();
		const beachNames = ["Lampuuk", "Lhoknga", "Ulee Lheue", "Depok", "Samas"];
		const found = await Promise.any(
			beachNames.map(async (name) => {
				const visible = await page.getByText(name, { exact: false }).isVisible().catch(() => false);
				if (visible) return true;
				throw new Error(`not found`);
			}),
		).catch(() => false);
		expect(found).toBe(true);
	});

	test("shows temperature data", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(/°C/).first()).toBeVisible({ timeout: 10000 });
	});
});
