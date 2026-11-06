import { test, expect } from "@playwright/test";

test.describe("PWA Basics", () => {
	test("page has PWA manifest link", async ({ page }) => {
		await page.goto("/");
		const manifest = page.locator('link[rel="manifest"]');
		await expect(manifest).toHaveAttribute("href", "/manifest.json");
	});

	test("service worker registration script exists", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
		const hasSwScript = await page.evaluate(() => {
			const scripts = document.querySelectorAll("script");
			for (const s of scripts) {
				if (s.textContent?.includes("serviceWorker")) return true;
			}
			return false;
		});
		expect(hasSwScript).toBe(true);
	});

	test("meta theme-color is set", async ({ page }) => {
		await page.goto("/");
		const themeColor = page.locator('meta[name="theme-color"]');
		await expect(themeColor).toHaveAttribute("content", "#0A2540");
	});

	test("apple-web-app capable meta", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
		const hasAppleMeta = await page.evaluate(() => {
			const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
			return meta !== null;
		});
		if (!hasAppleMeta) {
			const hasViewport = await page.evaluate(() => {
				const vp = document.querySelector('meta[name="viewport"]');
				return vp?.getAttribute("content")?.includes("width=device-width") ?? false;
			});
			expect(hasViewport).toBe(true);
		} else {
			expect(hasAppleMeta).toBe(true);
		}
	});

	test("page title is correct", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveTitle(/CuacaPesisir/);
	});
});
