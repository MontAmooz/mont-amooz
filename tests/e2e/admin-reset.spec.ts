// P10 — admin-issued password reset e2e: token generation in the panel, then
// redemption at #/reset and a successful login with the new password.
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, apiLogin, pageWithCookie } from "./utils";

test("admin generates a reset token and sees it in the dialog", async ({ page }) => {
  test.setTimeout(90000); // API setup + cold #/admin compile + table + dialog on a shared dev server
  // target: a fresh non-admin user
  const targetEmail = `reset-target-e2e-${Date.now()}@example.com`;
  const reg = await page.request.post("/api/v1/auth/register", {
    data: { email: targetEmail, password: "old-password-1", fullName: "کاربر بازنشانی" },
  });
  expect(reg.status()).toBe(201);

  const adminCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, adminCookie);
  // the copy button uses navigator.clipboard — headless Chromium needs the grant
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await p.goto("#/admin");
  await expect(p.getByRole("heading", { name: "پنل مدیریت" })).toBeVisible({ timeout: 20000 });

  const row = p.getByRole("row", { name: new RegExp(targetEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  await row.getByRole("button", { name: /بازنشانی رمز/ }).click();

  const tokenBox = p.getByRole("textbox", { name: "کد بازنشانی" });
  await expect(tokenBox).toBeVisible({ timeout: 10000 });
  const token = await tokenBox.inputValue();
  expect(token).toMatch(/^[0-9A-F]{32}$/);

  // the copy button reports success
  await p.getByRole("button", { name: /کپی/ }).click();
  await expect(p.getByText("کد کپی شد").first()).toBeVisible({ timeout: 5000 });
  await p.context().close();
});

test("user redeems the token at #/reset and logs in with the new password", async ({ page }) => {
  test.setTimeout(90000); // register + admin issue + reset + UI login on a shared dev server
  const targetEmail = `reset-redeem-e2e-${Date.now()}@example.com`;
  const reg = await page.request.post("/api/v1/auth/register", {
    data: { email: targetEmail, password: "old-password-1", fullName: "کاربر بازنشانی ۲" },
  });
  expect(reg.status()).toBe(201);

  // admin issues the token via the API (UI issuance covered by the other test)
  const adminCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const users = (await (await page.request.get("/api/v1/admin/users?pageSize=50")).json()) as {
    items: Array<{ id: string; email: string }>;
  };
  const targetId = users.items.find((u) => u.email === targetEmail)!.id;
  const issued = await page.request.post(`/api/v1/admin/users/${targetId}/reset`, {
    headers: { Cookie: adminCookie },
  });
  expect(issued.status()).toBe(201);
  const { token } = (await issued.json()) as { token: string };

  const p = await pageWithCookie(page.context().browser()!, ""); // anonymous — reset is public
  await p.goto("#/reset");
  const redeemBox = p.getByRole("textbox", { name: "کد بازنشانی" });
  await expect(redeemBox).toBeVisible({ timeout: 20000 });
  await redeemBox.fill(token.toLowerCase());
  await p.getByLabel("رمز جدید", { exact: true }).fill("reset-new-pass-9");
  await p.getByLabel("تکرار رمز جدید").fill("reset-new-pass-9");
  await p.getByRole("button", { name: "ثبت رمز جدید" }).click();

  await expect(p.getByText("رمز تغییر کرد. اکنون وارد شوید.")).toBeVisible({ timeout: 15000 });

  // login with the new password through the UI
  await p.goto("/");
  await p.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await expect(p.getByRole("dialog")).toBeVisible({ timeout: 20000 });
  await p.getByLabel("ایمیل").fill(targetEmail);
  await p.getByLabel("رمز عبور").fill("reset-new-pass-9");
  await p.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(p.getByRole("dialog")).toBeHidden({ timeout: 15000 });
  await p.context().close();
});
