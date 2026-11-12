// P8 — wallet: balance display, deposit via mock gateway, withdraw validation
// (3 scenarios).
import { test, expect } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie, faToNumber } from "./utils";

test("balance displays in Persian digits with تومان", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const api = await page.request.get("/api/v1/wallet", { headers: { cookie } });
  const { balance } = (await api.json()) as { balance: number };

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/wallet");
  await expect(p.getByText("موجودی فعلی")).toBeVisible({ timeout: 20000 });
  const shown = faToNumber(await p.locator(".oeg-mono").first().innerText());
  expect(shown).toBe(balance);
  await p.context().close();
});

test("deposit through the mock gateway credits the wallet", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const before = (await (await page.request.get("/api/v1/wallet", { headers: { cookie } })).json()) as { balance: number };

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/wallet");
  await p.getByRole("button", { name: "افزایش موجودی" }).click();
  // quick amount: ۱۰۰ هزار
  await p.getByRole("button", { name: /۱۰۰ هزار/ }).click();
  await p.getByRole("button", { name: "ادامه و پرداخت" }).click();
  // mock gateway (پرداخت‌یار) confirm — amount appears inside the button label
  const verifyResp = p.waitForResponse((r) => r.url().includes("/wallet/deposit/verify"), { timeout: 20000 });
  await p.getByRole("button", { name: /پرداخت .* تومان/ }).click();
  await verifyResp;
  await expect
    .poll(async () => {
      const w = (await (await p.request.get("/api/v1/wallet", { headers: { cookie } })).json()) as { balance: number };
      return w.balance;
    }, { timeout: 20000 })
    .toBe(before.balance + 100_000);
  await p.context().close();
});

test("withdraw below the minimum shows the validation error", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/wallet");
  const withdraw = p.getByRole("button", { name: "برداشت" });
  await withdraw.waitFor({ timeout: 20000 });
  // balance < 50_000 → button disabled; otherwise open dialog and submit ۱۰۰۰
  if (await withdraw.isEnabled()) {
    await withdraw.click();
    await p.locator("#wd-amount").fill("1000");
    await p.getByRole("button", { name: "ثبت برداشت" }).click();
    await expect(p.getByRole("alert")).toContainText(/حداقل مبلغ برداشت/);
  } else {
    await expect(withdraw).toBeDisabled();
  }
  await p.context().close();
});
