// P8 — mobile viewport: no horizontal overflow at 390×844, drawer + filters
// sheet (2 scenarios).
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("390px viewport has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href^="#/pamphlet/"]').first().waitFor({ timeout: 20000 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2); // subpixel rounding tolerance
});

test("hamburger drawer and filters sheet open", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href^="#/pamphlet/"]').first().waitFor({ timeout: 20000 });

  // drawer (navbar sheet)
  await page.getByLabel("باز کردن منو").click();
  await expect(page.getByText("منوی ناوبری و جستجوی اُپن‌ای‌دیو گیت")).toBeVisible({ timeout: 20000 });
  await page.keyboard.press("Escape");

  // filters sheet (browse section)
  await page.getByRole("button", { name: "فیلترها" }).first().click();
  const sheet = page.locator('[data-slot="sheet-content"], [role="dialog"]').last();
  await expect(sheet.getByRole("combobox").first()).toBeVisible({ timeout: 20000 });
});
