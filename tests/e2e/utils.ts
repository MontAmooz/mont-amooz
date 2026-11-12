// P8 — shared E2E helpers. Login cookies come from the real API; every
// selector is role/aria/text-based (the app ships no data-testid).
import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const DEMO_FOUNDER = { email: "montajebii@montamooz.ir", password: "123456" };
export const DEMO_STUDENT = { email: "hossein@montamooz.ir", password: "123456" };
export const DEMO_TEACHER_SARA = { email: "s.mohammadi@montamooz.ir", password: "123456" };

/** Persian digits → number (UI renders prices/balances with faNumber). */
export function faToNumber(s: string): number {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const latin = s.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d))).replace(/[^\d-]/g, "");
  return Number(latin);
}

/** Login through the real UI (used by auth specs and smoke-level checks). */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "ورود | ثبت‌نام" }).first().click();
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(password);
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await expect(page.getByLabel("حساب کاربری")).toBeVisible({ timeout: 10000 });
}

/** Login via the API → the "ma_session=…" cookie string. */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post("/api/v1/auth/login", { data: { email, password } });
  if (res.status() !== 200) throw new Error(`login ${email}: ${res.status()}`);
  return res.headers()["set-cookie"].split(";")[0];
}

/** New page whose context carries the given ma_session cookie. */
export async function pageWithCookie(
  browser: Browser,
  cookie: string
): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "ma_session", value: cookie.replace(/^ma_session=/, ""), url: "http://localhost:3100" },
  ]);
  return context.newPage();
}

/** Find the seeded math pamphlet (the one whose content holds $$…$$ formulas). */
export async function findMathPamphletId(request: APIRequestContext): Promise<string> {
  const list = await request.get("/api/v1/pamphlets?pageSize=48");
  if (!list.ok()) throw new Error(`pamphlet list failed: ${list.status()}`);
  const body = (await list.json()) as { items?: Array<{ id: string }> };
  for (const p of body.items ?? []) {
    const detail = await request.get(`/api/v1/pamphlets/${p.id}`);
    if (!detail.ok()) continue;
    const data = (await detail.json()) as { content?: string };
    if (data.content?.includes("$$")) return p.id;
  }
  throw new Error("no pamphlet with display math found in seed");
}
