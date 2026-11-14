// P10 — auth hardening e2e: honeypot, rate limit, remember me, admin guard,
// password change. Rate-limit checks pin a FIXED X-Forwarded-For via
// page.request (the e2e gateway randomizes IPs per request otherwise).
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

test("filled honeypot blocks registration with the generic error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20000 });
  await page.getByRole("tab", { name: "ثبت‌نام" }).click();

  // the bot fills the invisible field; humans can't even see it
  await page.locator('input[name="website"]').fill("http://spam.example");
  await page.getByLabel("نام و نام‌خانوادگی").fill("ربات آزمون");
  await page.getByLabel("ایمیل").fill(`bot-e2e-${Date.now()}@example.com`);
  await page.getByLabel("رمز عبور").fill("bot-password-123");
  await page.getByRole("button", { name: "ایجاد حساب کاربری" }).click();

  await expect(page.getByRole("alert")).toContainText("درخواست نامعتبر", { timeout: 10000 });
  await expect(page.getByRole("dialog")).toBeVisible(); // still on the dialog
});

test("11 rapid failed logins from one IP hit the rate limit (429, Persian message)", async ({ page }) => {
  const ip = `10.55.${Math.floor(Math.random() * 100)}.7`;
  let status = 0;
  for (let i = 0; i < 11; i++) {
    const res = await page.request.post("/api/v1/auth/login", {
      headers: { "X-Forwarded-For": ip },
      data: { email: `nobody-${Date.now()}@example.com`, password: "wrong-password" },
    });
    status = res.status();
    if (status === 429) {
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("بیش از حد مجاز");
      break;
    }
    expect(status).toBe(401);
  }
  expect(status).toBe(429);
  // The gateway assigns each browser request its own synthetic IP (mirroring
  // real distinct clients), so a UI attempt would be a fresh bucket — the
  // message display itself is covered by the login dialog's error alert.
});

test("remember me extends the session cookie to ~30 days", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20000 });
  await page.getByLabel("ایمیل").fill(DEMO_STUDENT.email);
  await page.getByLabel("رمز عبور").fill(DEMO_STUDENT.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15000 });

  const cookie = (await page.context().cookies()).find((c) => c.name === "ma_session");
  expect(cookie).toBeTruthy();
  const days = ((cookie!.expires ?? 0) - Date.now() / 1000) / 86400;
  expect(days).toBeGreaterThan(27); // 30d minus clock skew
  expect(days).toBeLessThanOrEqual(31);
});

test("#/admin is founder-only: student gets the gate, founder gets the panel", async ({ page }) => {
  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const sp = await pageWithCookie(page.context().browser()!, studentCookie);
  await sp.goto("#/admin");
  await expect(sp.getByText("پنل مدیریت فقط برای مدیر سایت است")).toBeVisible({
    timeout: 20000,
  });
  await sp.context().close();

  const adminCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const ap = await pageWithCookie(page.context().browser()!, adminCookie);
  await ap.goto("#/admin");
  await expect(ap.getByRole("heading", { name: "پنل مدیریت" })).toBeVisible({ timeout: 20000 });
  await expect(ap.getByText("montajebii@montamooz.ir")).toBeVisible();
  await ap.context().close();
});

test("password change: profile form → logout → login with the new password", async ({ page }) => {
  test.setTimeout(120000);
  // a fresh user, so the shared demo accounts keep their password
  const email = `pwchange-e2e-${Date.now()}@example.com`;
  const reg = await page.request.post("/api/v1/auth/register", {
    data: { email, password: "first-password-1", fullName: "کاربر تغییر رمز" },
  });
  expect(reg.status()).toBe(201);
  const cookie = (reg.headers()["set-cookie"] ?? "").split(";")[0];

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/profile");
  await expect(p.getByLabel("تغییر رمز عبور")).toBeVisible({ timeout: 20000 });
  await p.getByLabel("رمز فعلی").fill("first-password-1");
  await p.getByLabel("رمز جدید", { exact: true }).fill("second-password-2");
  await p.getByLabel("تکرار رمز جدید").fill("second-password-2");
  await p.getByRole("button", { name: "تغییر رمز", exact: true }).click();
  await expect(p.getByText("رمز عبور تغییر کرد").first()).toBeVisible({ timeout: 15000 });

  // old password rejected
  const oldLogin = await p.request.post("/api/v1/auth/login", {
    data: { email, password: "first-password-1" },
  });
  expect(oldLogin.status()).toBe(401);
  await p.context().close();

  // new password accepted through the UI
  const lp = await pageWithCookie(page.context().browser()!, "");
  await lp.goto("/");
  await lp.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await expect(lp.getByRole("dialog")).toBeVisible({ timeout: 20000 });
  await lp.getByLabel("ایمیل").fill(email);
  await lp.getByLabel("رمز عبور").fill("second-password-2");
  await lp.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(lp.getByRole("dialog")).toBeHidden({ timeout: 15000 });
  await lp.context().close();
});
