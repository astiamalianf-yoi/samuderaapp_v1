import { test, expect } from "@playwright/test";

test.describe("Pengetahuan Page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/pengetahuan");
    await expect(page.getByText("Pengetahuan Nelayan")).toBeVisible({ timeout: 15000 });
  });

  test("shows 10 trusted LIK signs", async ({ page }) => {
    await page.goto("/pengetahuan");
    await expect(page.getByText("Pengetahuan Nelayan")).toBeVisible({ timeout: 15000 });
    const signCards = page.locator("article");
    await expect(signCards).toHaveCount(10, { timeout: 10000 });
  });

  test("each sign shows name and description", async ({ page }) => {
    await page.goto("/pengetahuan");
    await expect(page.getByText("Pengetahuan Nelayan")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Awan turun")).toBeVisible();
    await expect(page.getByText("Kilat")).toBeVisible();
    await expect(page.getByText("Ombak besar")).toBeVisible();
  });
});
