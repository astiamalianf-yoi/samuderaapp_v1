import { test, expect } from "@playwright/test";
import { BEACH_NAMES, LIK_SIGN_LABELS } from "./fixtures/test-data";

test.describe("Report Submission", () => {
	test("lapor page loads", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
	});

	test("beach selector shows all 5 beaches", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
		for (const name of BEACH_NAMES) {
			await expect(page.getByText(name, { exact: true })).toBeVisible();
		}
	});

	test("selecting beach navigates to sign selector", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
		await page.getByText("Lampuuk", { exact: true }).click();
		await expect(page.getByText("Pilih Tanda Alam")).toBeVisible();
	});

	test("sign selector shows LIK signs", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
		await page.getByText("Lampuuk", { exact: true }).click();
		await expect(page.getByText("Pilih Tanda Alam")).toBeVisible();
		for (const label of LIK_SIGN_LABELS) {
			await expect(page.getByText(label)).toBeVisible();
		}
	});

	test("submit report sends POST request", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
		await page.getByText("Lampuuk", { exact: true }).click();
		await expect(page.getByText("Pilih Tanda Alam")).toBeVisible();
		await page.getByText("Kilat").click();

		const postPromise = page.waitForResponse(
			(resp) => resp.url().includes("/api/report") && resp.request().method() === "POST",
		);
		await page.getByRole("button", { name: /Kirim Laporan/i }).click();
		const response = await postPromise;
		expect(response.status()).toBe(200);
	});

	test("success message shown after submit", async ({ page }) => {
		await page.goto("/lapor");
		await expect(page.getByText("Pilih Pantai Anda")).toBeVisible({ timeout: 15000 });
		await page.getByText("Lampuuk", { exact: true }).click();
		await expect(page.getByText("Pilih Tanda Alam")).toBeVisible();
		await page.getByText("Kilat").click();

		await page.getByRole("button", { name: /Kirim Laporan/i }).click();
		await expect(page.getByText("Laporan Terkirim!")).toBeVisible({ timeout: 10000 });
	});
});
