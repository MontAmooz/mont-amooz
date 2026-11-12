// P8 — market + booking: teachers list, sort, book a slot (3 scenarios).
import { test, expect } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

test("market lists teacher cards", async ({ page }) => {
  await page.goto("/#/market");
  await expect(page.getByRole("article").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "رزرو کلاس" }).first()).toBeVisible();
});

test("sort control changes ordering response", async ({ page }) => {
  await page.goto("/#/market");
  await page.getByRole("article").first().waitFor({ timeout: 20000 });
  // arm the listener BEFORE the option click — the refetch lands within the
  // inter-command gap otherwise (Radix fires onValueChange synchronously)
  const sortResp = page.waitForResponse(
    (r) => r.url().includes("/api/v1/market/teachers") && r.url().includes("sort=price_asc"),
    { timeout: 20000 }
  );
  await page.getByLabel("مرتب‌سازی معلم‌ها").click();
  await page.getByRole("option", { name: /ارزان‌ترین/ }).click();
  await sortResp;
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("booking flow reserves a slot end-to-end", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  // sara has 500k in seed; find her slots
  const teachers = await page.request.get(
    "/api/v1/market/teachers?query=" + encodeURIComponent("سارا محمدی")
  );
  const { items } = (await teachers.json()) as { items?: Array<{ id: string }> };
  test.skip(!items?.length, "seed teacher not found in market");
  const teacherId = items![0].id;

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/book/${teacherId}`);
  const reserve = p.getByRole("button", { name: "رزرو", exact: true }).first();
  await reserve.waitFor({ timeout: 20000 });
  // arm the listener before the confirm click — the POST lands within the
  // inter-command gap otherwise (same lesson as the market sort test)
  const bookResp = p.waitForResponse(
    (r) => r.url().includes("/api/v1/sessions") && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await reserve.click();
  await p.getByRole("button", { name: "بله، رزرو کن" }).click();
  await bookResp;
  await expect(p).toHaveURL(/#\/sessions/, { timeout: 20000 });
  await p.context().close();
});
