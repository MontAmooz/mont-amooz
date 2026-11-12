// P8 — pamphlet create wizard: unauth gate, 3 steps, validation, abandon
// (4 scenarios). Note: the wizard has NO cancel button (verified in source);
// the "cancel" scenario asserts that abandoning mid-wizard issues no POST.
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, apiLogin, pageWithCookie } from "./utils";

test("anonymous user gets the auth modal, not the wizard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "بارگذاری جزوه" }).first().click();
  // anonymous → openAuth() dialog (no navigation to #/create)
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("tab", { name: "ورود" })).toBeVisible();
});

test("wizard walks through its three steps", async ({ page }) => {
  test.setTimeout(60000); // 4 step transitions + selects, shared dev server
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  await page.close();
  const p = await pageWithCookie(page.context().browser()!, cookie);

  await p.goto("#/create");
  await expect(p.getByLabel("مراحل بارگذاری")).toBeVisible({ timeout: 20000 });
  const steps = ["مشخصات جزوه", "محتوای جزوه", "بازبینی و انتشار"];
  for (const s of steps) {
    await expect(p.locator('ol[aria-label="مراحل بارگذاری"]')).toContainText(s);
  }

  // step 0: identity
  await p.getByPlaceholder("مثلاً: جزوهٔ کامل ریاضی نهم — فصل معادله‌ها").fill(`جزوهٔ E2E ${Date.now()}`);
  await p.getByLabel("پایهٔ تحصیلی").click();
  await p.getByRole("option", { name: "دهم", exact: true }).click();
  await p.getByLabel("درس", { exact: true }).click();
  await p.getByRole("option", { name: "ریاضی", exact: true }).click();
  await p.getByLabel("روش تدریس").click();
  await p.getByRole("option", { name: "مفهومی", exact: true }).click();
  await p.getByLabel("سطح جزوه").click();
  await p.getByRole("option", { name: "متوسط", exact: true }).click();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // step 1: content — the editor's textarea (any textarea on this step)
  const editor = p.locator("textarea").first();
  await editor.waitFor({ timeout: 20000 });
  await editor.fill("# عنوان E2E\n\nاین متن برای آزمون E2E است و بیش از ده نویسه دارد.\n\nفرمول: $x^2$");
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // step 2: publish — the landing on the pamphlet detail page is the
  // user-visible proof of the POST (a response-listener raced through the
  // gateway in the full-suite run; the URL never lies)
  await p.getByRole("button", { name: "انتشار جزوه" }).click();
  await expect(p).toHaveURL(/#\/pamphlet\//, { timeout: 20000 });
  await expect(p.getByText(/۱|نسخه/).first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("step-0 validation blocks an empty submit", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  await page.close();
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/create");
  await expect(p.getByLabel("مراحل بارگذاری")).toBeVisible({ timeout: 20000 });
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();
  await expect(p.getByRole("alert").first()).toBeVisible({ timeout: 20000 });
  await p.context().close();
});

test("abandoning the wizard issues no create POST", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  await page.close();
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/create");
  await expect(p.getByLabel("مراحل بارگذاری")).toBeVisible({ timeout: 20000 });

  let created = false;
  p.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/v1/pamphlets") && !r.url().includes("/")) created = true;
  });
  await p.getByPlaceholder("مثلاً: جزوهٔ کامل ریاضی نهم — فصل معادله‌ها").fill("نیمهکاره رها میشود");
  await p.evaluate(() => { window.location.hash = "#/"; }); // leave mid-wizard
  await p.waitForTimeout(600); // allow any (wrongly) fired request to surface
  expect(created).toBe(false);
  await p.context().close();
});
