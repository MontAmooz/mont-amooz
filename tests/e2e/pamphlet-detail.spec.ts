// P8 — pamphlet detail: title/author, 5 tabs, KaTeX math (3 scenarios).
import { test, expect } from "@playwright/test";
import { findMathPamphletId } from "./utils";

test("detail loads title and author", async ({ page }) => {
  const res = await page.request.get("/api/v1/pamphlets?pageSize=1");
  const { items } = (await res.json()) as { items: Array<{ id: string }> };
  await page.goto(`#/pamphlet/${items[0].id}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/نوشتهٔ/)).toBeVisible();
});

test("detail shows the five tabs", async ({ page }) => {
  const res = await page.request.get("/api/v1/pamphlets?pageSize=1");
  const { items } = (await res.json()) as { items: Array<{ id: string }> };
  await page.goto(`#/pamphlet/${items[0].id}`);
  for (const tab of ["محتوا", "تاریخچه", "مشارکت‌کنندگان", "بازخوردها", "درخواست‌های ادغام"]) {
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible({ timeout: 20000 });
  }
});

test("KaTeX math renders as MathML/KaTeX, not raw $$", async ({ page }) => {
  const id = await findMathPamphletId(page.request);
  await page.goto(`#/pamphlet/${id}`);
  const katex = page.locator(".katex").first();
  await expect(katex).toBeVisible({ timeout: 20000 });
  const body = await page.locator("main").innerText();
  expect(body).not.toContain("$$f'(x)");
});
