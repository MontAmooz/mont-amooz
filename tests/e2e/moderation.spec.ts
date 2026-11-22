// P20 — moderation e2e:
//  · student reports a pamphlet via the dialog → admin sees it in the queue
//  · admin hides the pamphlet → strangers 404, author still sees it
//  · admin suspends a user → login refused; unsuspend restores
// Fixture content starts at ## (P19 lesson: markdown # renders a second h1).
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, apiLogin, pageWithCookie } from "./utils";

const PASSWORD = "test-password-1234";

/** Fresh pamphlet by the founder → { id } (deterministic author for test 2). */
async function founderPamphlet(
  request: import("@playwright/test").APIRequestContext,
  cookie: string
): Promise<string> {
  const created = await request.post("/api/v1/pamphlets", {
    headers: { Cookie: cookie },
    data: {
      title: `جزوهٔ مدیریت P20 ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "## جزوهٔ آزمون مدیریت\n\nاین جزوه برای آزمون ابزارهای مدیریت است و بیش از سی نویسه دارد.",
    },
  });
  expect(created.status()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

/** Fresh user via the API → { email, id, cookie }. */
async function apiRegister(request: import("@playwright/test").APIRequestContext) {
  const email = `mod-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@montamooz.ir`;
  const res = await request.post("/api/v1/auth/register", {
    data: { email, password: PASSWORD, fullName: "کاربر مدیریت", role: "دانش‌آموز" },
  });
  expect(res.status()).toBe(201);
  const cookie = res.headers()["set-cookie"].split(";")[0];
  const { user } = (await res.json()) as { user: { id: string } };
  return { email, id: user.id, cookie };
}

test("student reports a pamphlet; the admin sees it in the reports queue", async ({ page, browser }) => {
  test.setTimeout(120000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const pid = await founderPamphlet(page.request, founderCookie);
  const student = await apiRegister(page.request);

  const s = await pageWithCookie(browser, student.cookie);
  await s.goto(`#/pamphlet/${pid}`);
  await expect(s.getByRole("heading", { name: /جزوهٔ مدیریت P20/ })).toBeVisible({ timeout: 20000 });

  // report via the dialog
  await s.getByRole("button", { name: "گزارش" }).click();
  await expect(s.getByText("گزارش محتوا")).toBeVisible({ timeout: 10000 });
  await s.getByRole("radio", { name: /کپی‌برداری|copyright/ }).check();
  await s.getByLabel("توضیحات").fill("این محتوا کپی است");
  await s.getByRole("button", { name: "ارسال گزارش" }).click();
  await expect(s.getByText("گزارش شما ثبت شد").first()).toBeVisible({ timeout: 10000 });
  await s.context().close();

  // the admin finds it in the queue
  const admin = await pageWithCookie(browser, founderCookie);
  await admin.goto("#/admin");
  await expect(admin.getByRole("heading", { name: "پنل مدیریت" })).toBeVisible({ timeout: 20000 });
  await admin.getByRole("tab", { name: "گزارش‌ها" }).click();
  await expect(admin.getByText("این محتوا کپی است")).toBeVisible({ timeout: 10000 });
  await admin.context().close();
});

test("admin hides a reported pamphlet — strangers 404, the author still sees it", async ({ page, browser }) => {
  test.setTimeout(180000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const pid = await founderPamphlet(page.request, founderCookie);
  const student = await apiRegister(page.request);

  // the report
  const s = await pageWithCookie(browser, student.cookie);
  await s.goto(`#/pamphlet/${pid}`);
  await expect(s.getByRole("heading", { name: /جزوهٔ مدیریت P20/ })).toBeVisible({ timeout: 20000 });
  await s.getByRole("button", { name: "گزارش" }).click();
  await s.getByRole("radio", { name: /محتوای نامناسب|inappropriate/ }).check();
  await s.getByRole("button", { name: "ارسال گزارش" }).click();
  await expect(s.getByText("گزارش شما ثبت شد").first()).toBeVisible({ timeout: 10000 });

  // admin: hide the pamphlet from the queue, then resolve with action_taken
  const admin = await pageWithCookie(browser, founderCookie);
  await admin.goto("#/admin");
  await admin.getByRole("tab", { name: "گزارش‌ها" }).click();
  const reportRow = admin.locator("tr, article, li").filter({ hasText: "جزوهٔ مدیریت P20" }).first();
  await expect(reportRow).toBeVisible({ timeout: 10000 });
  await reportRow.getByRole("button", { name: "پنهان کردن جزوه" }).click();
  await expect(admin.getByText("جزوه پنهان شد").first()).toBeVisible({ timeout: 10000 });
  await reportRow.getByRole("button", { name: "اقدام شد" }).click();
  await expect(admin.getByText("گزارش بررسی شد").first()).toBeVisible({ timeout: 10000 });

  // hidden from the public list
  const list = await page.request.get("/api/v1/pamphlets?pageSize=48");
  const items = ((await list.json()) as { items: Array<{ id: string }> }).items;
  expect(items.some((x) => x.id === pid)).toBe(false);

  // stranger's session → the detail page shows the not-found error
  await s.reload();
  await expect(s.getByText("جزوه پیدا نشد")).toBeVisible({ timeout: 15000 });
  await s.context().close();

  // the author still sees their own pamphlet
  const a = await pageWithCookie(browser, founderCookie);
  await a.goto(`#/pamphlet/${pid}`);
  await expect(a.getByRole("heading", { name: /جزوهٔ مدیریت P20/ })).toBeVisible({ timeout: 20000 });
  await a.context().close();
  await admin.context().close();
});

test("admin suspends a user — login refused; unsuspend restores access", async ({ page, browser }) => {
  test.setTimeout(180000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const victim = await apiRegister(page.request);

  const admin = await pageWithCookie(browser, founderCookie);
  await admin.goto("#/admin");
  await expect(admin.getByRole("heading", { name: "پنل مدیریت" })).toBeVisible({ timeout: 20000 });
  await admin.getByRole("tab", { name: "کاربران" }).click();

  const userRow = admin.locator("tr").filter({ hasText: victim.email });
  await expect(userRow).toBeVisible({ timeout: 10000 });
  await userRow.getByRole("button", { name: "تعلیق", exact: true }).click();
  await expect(admin.getByText("کاربر معلق شد").first()).toBeVisible({ timeout: 10000 });
  // the row now shows the suspended badge
  await expect(userRow.getByText("معلق").first()).toBeVisible();

  // the suspended user cannot log in through the UI
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByLabel("ایمیل").fill(victim.email);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByText(/معلق شده است/)).toBeVisible({ timeout: 10000 });

  // unsuspend → login works again
  await userRow.getByRole("button", { name: "رفع تعلیق" }).click();
  await expect(admin.getByText("تعلیق رفع شد").first()).toBeVisible({ timeout: 10000 });
  await admin.context().close();

  await page.getByLabel("ایمیل").fill(victim.email);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByRole("button", { name: "حساب کاربری" })).toBeVisible({ timeout: 15000 });
});
