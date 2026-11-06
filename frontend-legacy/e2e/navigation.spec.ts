import { test, expect } from "@playwright/test";

test.describe("Bottom Navigation", () => {
  test("bottom nav is visible on home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible({ timeout: 15000 });
  });

  test("navigates to Lapor page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: /lapor/i }).click();
    await expect(page).toHaveURL(/\/lapor/);
    await expect(page.getByText("Pilih Pantai")).toBeVisible();
  });

  test("navigates to Peta page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: /peta/i }).click();
    await expect(page).toHaveURL(/\/peta/);
    await expect(page.getByText("Peta Pantai")).toBeVisible();
  });

  test("navigates to Pengetahuan page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: /pengetahuan/i }).click();
    await expect(page).toHaveURL(/\/pengetahuan/);
    await expect(page.getByText("Pengetahuan Nelayan")).toBeVisible();
  });

  test("Beranda tab navigates home", async ({ page }) => {
    await page.goto("/lapor");
    await expect(page.locator("nav")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: /beranda/i }).click();
    await expect(page).toHaveURL(/\//);
  });
});
