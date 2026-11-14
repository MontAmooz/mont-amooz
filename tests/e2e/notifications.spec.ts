// P11 — notifications e2e: bell badge, popover, mark-read navigation, full page.
// Triggers fire through the API (page.request); the browser-side assertions
// cover the 30s-polling UI (store refresh is also invoked by mark-read paths).
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

test("a triggered notification shows in the bell, opens its target and marks read", async ({ page }) => {
  test.setTimeout(120000);
  // founder session first — the create and the bell both need it
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  // fresh pamphlet by the founder; student reviews it → founder notified
  const created = await page.request.post("/api/v1/pamphlets", {
    headers: { Cookie: founderCookie },
    data: {
      title: `جزوهٔ اعلان E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "# اعلان\n\nاین جزوه برای آزمون اعلان بازخورد است و بیش از سی نویسه دارد.",
    },
  });
  expect(created.status()).toBe(201);
  const { id: pamphletId } = (await created.json()) as { id: string };
  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const reviewed = await page.request.post(`/api/v1/pamphlets/${pamphletId}/reviews`, {
    headers: { Cookie: studentCookie },
    data: { rating: 5, comment: "اعلان آزمونی" },
  });
  expect(reviewed.status()).toBe(200);

  const founderPage = await pageWithCookie(page.context().browser()!, (await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password)));
  await founderPage.goto("/");
  // the bell is visible for logged-in users (badge presence depends on prior
  // unread notifications from other specs — don't assert it)
  const bell = founderPage.getByRole("button", { name: /اعلان‌ها/ });
  await expect(bell).toBeVisible({ timeout: 30000 });

  await bell.click();
  const dialog = founderPage.getByRole("dialog", { name: "اعلان‌های اخیر" });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText("بازخورد جدید")).toBeVisible();

  // clicking the row marks it read and navigates to the pamphlet
  await dialog.getByText("بازخورد جدید").click();
  await expect(founderPage).toHaveURL(new RegExp(`#/pamphlet/${pamphletId}`), { timeout: 10000 });
  await founderPage.context().close();
});

test("#/notifications lists items, filters unread and marks all read", async ({ page }) => {
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, founderCookie);

  // trigger two notifications (two reviews on two fresh pamphlets)
  for (let i = 0; i < 2; i++) {
    const created = await page.request.post("/api/v1/pamphlets", {
      headers: { Cookie: founderCookie },
      data: {
        title: `جزوهٔ صفحهٔ اعلان ${i} ${Date.now()}`,
        grade: "دهم",
        subject: "ریاضی",
        teachingMethod: "مفهومی",
        difficulty: "متوسط",
        content: "# اعلان صفحه\n\nمحتوای آزمونی برای صفحهٔ اعلان‌ها با بیش از سی نویسه.",
      },
    });
    const { id } = (await created.json()) as { id: string };
    const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
    const r = await page.request.post(`/api/v1/pamphlets/${id}/reviews`, {
      headers: { Cookie: studentCookie },
      data: { rating: 4, comment: `اعلان صفحه ${i}` },
    });
    expect(r.status()).toBe(200);
  }

  await p.goto("#/notifications");
  await expect(p.getByRole("heading", { name: "اعلان‌ها" })).toBeVisible({ timeout: 30000 });
  await expect(p.getByText("بازخورد جدید").first()).toBeVisible({ timeout: 10000 });

  // unread filter shows them; mark-all-read empties it
  await p.getByRole("tab", { name: "خوانده‌نشده" }).click();
  await expect(p.getByText("بازخورد جدید").first()).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "علامت‌گذاری همه به‌عنوان خوانده" }).click();
  await expect(p.getByText("همه اعلان‌ها خوانده شد").first()).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("خوانده‌نشده‌ای ندارید")).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("anonymous users see no bell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /اعلان‌ها/ })).toHaveCount(0);
});

test("read notifications lose their unread indicator", async ({ page }) => {
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const created = await page.request.post("/api/v1/pamphlets", {
    headers: { Cookie: founderCookie },
    data: {
      title: `جزوهٔ خوانده‌شدنی ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "# خواندنی\n\nاین جزوه برای آزمون خوانده‌شدن اعلان است و بیش از سی نویسه دارد.",
    },
  });
  const { id } = (await created.json()) as { id: string };
  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  await page.request.post(`/api/v1/pamphlets/${id}/reviews`, {
    headers: { Cookie: studentCookie },
    data: { rating: 3, comment: "برای خواندن" },
  });

  const p = await pageWithCookie(page.context().browser()!, founderCookie);
  await p.goto("#/notifications");
  const row = p.getByRole("button").filter({ hasText: "بازخورد جدید" }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row.getByLabel("خوانده‌نشده")).toBeVisible();
  await row.click(); // navigates away and marks read

  await p.goto("#/notifications");
  const readRow = p.getByRole("button").filter({ hasText: "بازخورد جدید" }).first();
  await expect(readRow).toBeVisible({ timeout: 10000 });
  await expect(readRow.getByLabel("خوانده‌نشده")).toHaveCount(0);
  await p.context().close();
});
