// P8 — home: render, search, filters, pagination (4 scenarios).
import { test, expect } from "@playwright/test";

test("home renders with stats and pamphlet cards", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/مُنت‌آموز/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // cards live in the browse section; each is an <a href="#/pamphlet/{id}">
  await expect(page.locator('a[href^="#/pamphlet/"]').first()).toBeVisible({
    timeout: 10000,
  });
});

test("search filters results (debounced)", async ({ page }) => {
  await page.goto("/");
  const firstCard = page.locator('a[href^="#/pamphlet/"]').first();
  await firstCard.waitFor({ timeout: 20000 });

  // scope to the browse-section input (the navbar has a same-labeled input).
  // Type with key events so React's onChange fires (fill() can bypass it on
  // search inputs), then let the 300ms debounce drive the URL + refetch.
  const input = page.locator('form[role="search"] input[type="search"]').last();
  await input.click();
  await input.pressSequentially("حسابان", { delay: 50 });
  await page.waitForResponse((r) => r.url().includes("/api/v1/pamphlets") && r.url().includes("query="), { timeout: 20000 });
  const cards = page.locator('a[href^="#/pamphlet/"]');
  await expect.poll(async () => cards.count(), { timeout: 20000 }).toBeLessThan(12);
  expect(await cards.count()).toBeGreaterThan(0);
  // URL carries the query — the observable contract of the debounced search
  await expect(page).toHaveURL(/q=%D8%AD%D8%B3%D8%A7%D8%A8%D8%A7%D9%86/);
});

test("grade filter narrows results", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href^="#/pamphlet/"]').first().waitFor({ timeout: 20000 });

  // scope to the desktop aside (mobile sheet copy is hidden but present in DOM)
  const aside = page.locator('aside[aria-label]').first();
  await aside.getByRole("combobox").first().click();
  // arm the listener BEFORE choosing — the refetch can land within milliseconds
  const gradeResp = page.waitForResponse(
    (r) => r.url().includes("/api/v1/pamphlets") && decodeURIComponent(r.url()).includes("grade=دهم"),
    { timeout: 20000 }
  );
  await page.getByRole("option", { name: "دهم", exact: true }).click();
  await gradeResp;
  await expect(page).toHaveURL(/grade=/);
});

test("pagination navigates pages", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href^="#/pamphlet/"]').first().waitFor({ timeout: 20000 });

  const next = page.getByLabel("صفحهٔ بعد");
  await next.waitFor({ timeout: 20000 }); // seed (>12) + shared-DB pamphlets ⇒ 2 pages
  await next.click();
  // user-visible signal: the current-page chip moves to ۲ after the refetch
  await expect(page.locator('nav[aria-label="صفحه‌بندی نتایج"] [aria-current="page"]')).toHaveText(/۲|2/, { timeout: 15000 });
});
