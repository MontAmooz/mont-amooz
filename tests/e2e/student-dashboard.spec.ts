// P18 — student learning dashboard e2e:
//  · fresh user → empty state with 3 CTAs and zeroed summary cards
//  · demo student (hossein) → populated summary + recent activity, first row navigates
import { test, expect } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

const PASSWORD = "test-password-1234";

test("fresh user sees the empty dashboard with 3 CTAs and zeroed cards", async ({ page }) => {
  test.setTimeout(120000);

  // fresh localStorage (welcome flag) — cookies don't cover localStorage
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  // register via the UI (defaults to a teacher account — dashboard is for everyone)
  const email = `dash-e2e-${Date.now()}@montamooz.ir`;
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByRole("tab", { name: "ثبت‌نام" }).click();
  await page.getByLabel("نام و نام‌خانوادگی").fill("کاربر داشبورد");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ایجاد حساب کاربری" }).click();

  // welcome flow → skip to home
  await expect(page).toHaveURL(/#\/welcome/, { timeout: 20000 });
  await page.getByRole("button", { name: "رد کردن" }).click();
  await expect(page).not.toHaveURL(/#\/welcome/, { timeout: 10000 });

  // navigate through the user menu — the P18 wiring point
  await page.getByRole("button", { name: "حساب کاربری" }).click();
  await page.getByRole("menuitem", { name: "پیشرفت من" }).click();
  await expect(page).toHaveURL(/#\/my-learning/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "پیشرفت من", level: 1 })).toBeVisible({
    timeout: 20000,
  });

  // summary cards all zero (started count is 0 whatever the seed holds)
  await expect(page.getByText(/۰ از [۰-۹]+/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("۰ تکمیل شده")).toBeVisible();
  await expect(page.getByText("هنوز شرکت نکرده‌اید")).toBeVisible();
  await expect(page.getByText("هنوز ثبت‌نام نکرده‌اید")).toBeVisible();
  await expect(page.getByText("بدون جلسهٔ پیش‌رو")).toBeVisible();

  // empty state with the 3 CTAs
  await expect(page.getByText("شما هنوز فعالیتی نداشته‌اید")).toBeVisible();
  await expect(page.getByRole("button", { name: "مشاهدهٔ درس‌ها" })).toBeVisible();
  await expect(page.getByRole("button", { name: "شرکت در آزمون" })).toBeVisible();
  await expect(page.getByRole("button", { name: "دوره‌ها", exact: true })).toBeVisible();
});

test("demo student sees a populated dashboard; first activity navigates to its detail", async ({ page }) => {
  test.setTimeout(120000);
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);

  await p.goto("#/my-learning");
  await expect(p.getByRole("heading", { name: "پیشرفت من", level: 1 })).toBeVisible({
    timeout: 20000,
  });

  // hossein's seed has GRADED exam attempts → exams card shows an average
  // (the courses card's sub starts with «میانگین پیشرفت» — anchor on the digit)
  await expect(p.getByText(/میانگین [۰-۹]/)).toBeVisible({ timeout: 10000 });

  // recent activity list (scoped to its section) has at least one row
  const recentSection = p.locator("section").filter({ hasText: "فعالیت‌های اخیر" });
  const firstRow = recentSection.locator("ul > li a").first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });

  // click the first activity row → lands on its detail hash
  const href = await firstRow.getAttribute("href");
  expect(href).toMatch(/^#\//);
  await firstRow.click();
  await expect(p).toHaveURL((url) => url.hash === href, { timeout: 10000 });
  await p.context().close();
});
