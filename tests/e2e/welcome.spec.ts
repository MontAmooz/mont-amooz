// P16 — welcome flow e2e: first login lands on #/welcome, finishing/skipping
// sets the localStorage flag, and a later login does NOT redirect again.
import { test, expect } from "@playwright/test";

const EMAIL = `welcome-e2e-${Date.now()}@montamooz.ir`;
const PASSWORD = "test-password-1234";

async function registerViaUI(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByRole("tab", { name: "ثبت‌نام" }).click();
  await page.getByLabel("نام و نام‌خانوادگی").fill("کاربر خوشامدگو");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ایجاد حساب کاربری" }).click();
}

test("first login lands on #/welcome; finishing sets the flag; re-login skips it", async ({ page }) => {
  test.setTimeout(120000);

  // fresh localStorage (retry safety) — cookies don't cover localStorage
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  await registerViaUI(page);
  await expect(page).toHaveURL(/#\/welcome/, { timeout: 20000 });
  await expect(page.getByText("به مُنت‌آموز خوش آمدید")).toBeVisible({ timeout: 10000 });

  // step 2 — سه راه شروع
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.getByText("سه راه شروع")).toBeVisible({ timeout: 10000 });

  // the fresh account defaults to معلم → a third step exists
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.getByText("شما معلم هستید")).toBeVisible({ timeout: 10000 });

  // finish → home
  await page.getByRole("button", { name: "شروع کنید" }).click();
  await expect(page).not.toHaveURL(/#\/welcome/, { timeout: 10000 });

  // logout
  await page.getByRole("button", { name: "حساب کاربری" }).click();
  await page.getByRole("menuitem", { name: "خروج" }).click();
  await expect(page.getByRole("button", { name: "ورود | ثبت‌نام" }).first()).toBeVisible({ timeout: 10000 });

  // re-login — flag already set → no welcome redirect
  // (the dialog keeps its tab state across opens: the register tab is still
  // selected, so explicitly switch to ورود)
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByRole("tab", { name: "ورود" }).click();
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByRole("button", { name: "حساب کاربری" })).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/#\/$|#$|localhost:3100\/$/, { timeout: 5000 });
  await expect(page.getByText("به مُنت‌آموز خوش آمدید")).toHaveCount(0);
});

test("«رد کردن» skips the intro and lands on home", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  const email = `welcome-skip-${Date.now()}@montamooz.ir`;
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByRole("tab", { name: "ثبت‌نام" }).click();
  await page.getByLabel("نام و نام‌خانوادگی").fill("کاربر عجول");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(PASSWORD);
  await page.getByRole("button", { name: "ایجاد حساب کاربری" }).click();
  await expect(page).toHaveURL(/#\/welcome/, { timeout: 20000 });

  await page.getByRole("button", { name: "رد کردن" }).click();
  await expect(page).toHaveURL(/#\/$|#$|localhost:3100\/$/, { timeout: 10000 });
  await expect(page.getByText("به مُنت‌آموز خوش آمدید")).toHaveCount(0);

  // the skip also set the flag — a reload + re-login stays on home
  await page.reload();
  await expect(page.getByText("به مُنت‌آموز خوش آمدید")).toHaveCount(0);
});
