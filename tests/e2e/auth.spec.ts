// P8 — auth: register, login, wrong password, logout (4 scenarios).
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, loginViaUI } from "./utils";

test("register creates a session (logged-in header appears)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByRole("tab", { name: "ثبت‌نام" }).click();

  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@montamooz.ir`;
  await page.locator("#reg-name").fill("کاربر E2E");
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-password").fill("e2e-password-1234");
  await page.getByRole("button", { name: "ایجاد حساب کاربری" }).click();

  await expect(page.getByLabel("حساب کاربری")).toBeVisible({ timeout: 20000 });
});

test("login with demo founder works", async ({ page }) => {
  await loginViaUI(page, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  await expect(page.getByLabel("حساب کاربری")).toContainText("محمدرضا منتجبی");
});

test("wrong password shows the server error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByLabel("ایمیل").fill(DEMO_FOUNDER.email);
  await page.getByLabel("رمز عبور").fill("definitely-wrong");
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("alert")).toContainText(/رمز|نادرست|اشتباه/);
});

test("logout clears the session", async ({ page }) => {
  await loginViaUI(page, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  await page.getByLabel("حساب کاربری").click();
  await page.getByRole("menuitem", { name: "خروج" }).click();
  await expect(page.getByRole("button", { name: "ورود | ثبت‌نام" }).first()).toBeVisible({
    timeout: 10000,
  });
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "ma_session")?.value ?? "").toBe("");
});
