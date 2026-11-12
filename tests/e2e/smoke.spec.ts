// P8 — smoke wiring test. Brand note: the visible UI brand is still
// «اُپن‌ای‌دیو گیت» — layout.tsx metadata was not renamed in P6 (known issue,
// src/ is frozen in P8; see .diag/34 + PR notes). So the title asserts the
// real string, not «مُنت‌آموز».
import { test, expect } from "@playwright/test";

test("server is up and home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/اُپن‌ای‌دیو گیت|MontAmooz/);
});
