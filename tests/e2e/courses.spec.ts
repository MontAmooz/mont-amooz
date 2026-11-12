// P8 — courses: list, locked lessons, purchase unlocks (3 scenarios).
import { test, expect } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

test("courses list renders cards", async ({ page }) => {
  await page.goto("/#/courses");
  await expect(page.getByRole("heading", { name: "دوره‌های ویدیویی" })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('a[href^="#/course/"]').first()).toBeVisible({ timeout: 20000 });
});

test("paid course shows locked lessons or is already owned", async ({ page }) => {
  const list = await page.request.get("/api/v1/courses?pageSize=48");
  const { items } = (await list.json()) as {
    items?: Array<{ id: string; price: number; lessonCount: number }>;
  };
  const paid = (items ?? []).find((c) => c.price > 0 && c.lessonCount > 0);
  test.skip(!paid, "no paid course with lessons in seed");
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/course/${paid!.id}`);
  // hossein bought course 1 in seed — the detail must show EITHER a locked
  // lesson indicator OR the owned-state "continue learning" button.
  const locked = p.getByText(/قفل/).first();
  const owned = p.getByRole("button", { name: "ادامهٔ یادگیری" });
  await expect(locked.or(owned)).toBeVisible({ timeout: 20000 });
  await p.context().close();
});

test("free course enroll flow completes without wallet", async ({ page }) => {
  const list = await page.request.get("/api/v1/courses?pageSize=48");
  const { items } = (await list.json()) as { items?: Array<{ id: string; price: number }> };
  const free = (items ?? []).find((c) => c.price === 0);
  test.skip(!free, "no free course in seed");
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/course/${free!.id}`);
  const enroll = p.getByRole("button", { name: "ثبت‌نام رایگان" });
  await enroll.waitFor({ timeout: 20000 });
  await enroll.click();
  const purchaseResp = p.waitForResponse(
    (r) => r.url().includes("/purchase") && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await p.getByRole("button", { name: /تأیید|بله/ }).click();
  await purchaseResp;
  // after enrollment the buy button flips to the owned-state CTA
  await expect(p.getByRole("button", { name: "ادامهٔ یادگیری" })).toBeVisible({ timeout: 20000 });
  await p.context().close();
});
