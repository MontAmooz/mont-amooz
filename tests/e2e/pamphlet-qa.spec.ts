// P19 — pamphlet Q&A e2e:
//  · student posts a question → pamphlet author replies → student sees the reply
//  · deleting your own comment leaves the placeholder
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

/** Fresh pamphlet by the founder → { id } (deterministic author for replies). */
async function founderPamphlet(
  request: import("@playwright/test").APIRequestContext,
  cookie: string
): Promise<string> {
  const created = await request.post("/api/v1/pamphlets", {
    headers: { Cookie: cookie },
    data: {
      title: `جزوهٔ پرسش‌وپاسخ P19 ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "## جزوهٔ پرسش و پاسخ\n\nاین جزوه برای آزمون تب پرسش و پاسخ است و بیش از سی نویسه دارد.",
    },
  });
  expect(created.status()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

test("student asks, the author replies, the student sees the reply", async ({ page, browser }) => {
  test.setTimeout(120000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const pid = await founderPamphlet(page.request, founderCookie);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const s = await pageWithCookie(browser, studentCookie);

  await s.goto(`#/pamphlet/${pid}`);
  await expect(s.getByRole("heading", { name: /جزوهٔ پرسش‌وپاسخ P19/ })).toBeVisible({ timeout: 20000 });
  await s.getByRole("tab", { name: /پرسش و پاسخ/ }).click();
  await expect(s.getByText("هنوز پرسشی ثبت نشده است")).toBeVisible({ timeout: 10000 });

  // post a top-level question
  await s.getByLabel("متن پرسش یا پاسخ").fill("این قسمت را نمی‌فهمم — می‌شود مثال بزنید؟");
  await s.getByRole("button", { name: "ارسال پرسش" }).click();
  await expect(s.getByText("این قسمت را نمی‌فهمم — می‌شود مثال بزنید؟")).toBeVisible({
    timeout: 10000,
  });
  // no «نویسندهٔ جزوه» badge on the student's question
  const questionRow = s.locator("article").filter({ hasText: "این قسمت را نمی‌فهمم" });
  await expect(questionRow.getByText("نویسندهٔ جزوه")).toHaveCount(0);
  // the tab badge refetches the detail → shows ۱
  await expect(s.getByRole("tab", { name: /پرسش و پاسخ/ })).toContainText("۱", { timeout: 10000 });

  // the pamphlet author replies from their own session
  const f = await pageWithCookie(browser, founderCookie);
  await f.goto(`#/pamphlet/${pid}`);
  await expect(f.getByRole("heading", { name: /جزوهٔ پرسش‌وپاسخ P19/ })).toBeVisible({ timeout: 20000 });
  await f.getByRole("tab", { name: /پرسش و پاسخ/ }).click();
  await expect(f.getByText("این قسمت را نمی‌فهمم — می‌شود مثال بزنید؟")).toBeVisible({
    timeout: 10000,
  });
  await f.getByRole("button", { name: "پاسخ", exact: true }).first().click();
  await expect(f.getByText(/در پاسخ به پیام/)).toBeVisible();
  await f.getByLabel("متن پرسش یا پاسخ").fill("حتماً — صفحهٔ ۳ را دوباره بخوانید و روی مثال ۲ تمرکز کنید.");
  await f.getByRole("button", { name: "ارسال پاسخ" }).click();
  await expect(f.getByText("حتماً — صفحهٔ ۳ را دوباره بخوانید و روی مثال ۲ تمرکز کنید.")).toBeVisible({
    timeout: 10000,
  });
  // the reply carries the author badge
  const replyRow = f.locator("article").filter({ hasText: "حتماً — صفحهٔ ۳ را دوباره بخوانید" });
  await expect(replyRow.getByText("نویسندهٔ جزوه").first()).toBeVisible();
  await f.context().close();

  // the student re-opens the pamphlet and sees the reply nested under the question
  await s.reload();
  await expect(s.getByRole("heading", { name: /جزوهٔ پرسش‌وپاسخ P19/ })).toBeVisible({ timeout: 20000 });
  await s.getByRole("tab", { name: /پرسش و پاسخ/ }).click();
  await expect(s.getByText("حتماً — صفحهٔ ۳ را دوباره بخوانید و روی مثال ۲ تمرکز کنید.")).toBeVisible({
    timeout: 10000,
  });
  await s.context().close();
});

test("deleting your own comment leaves the placeholder in place", async ({ page, browser }) => {
  test.setTimeout(120000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const pid = await founderPamphlet(page.request, founderCookie);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const s = await pageWithCookie(browser, studentCookie);

  await s.goto(`#/pamphlet/${pid}`);
  await expect(s.getByRole("heading", { name: /جزوهٔ پرسش‌وپاسخ P19/ })).toBeVisible({ timeout: 20000 });
  await s.getByRole("tab", { name: /پرسش و پاسخ/ }).click();
  await expect(s.getByText("هنوز پرسشی ثبت نشده است")).toBeVisible({ timeout: 10000 });

  await s.getByLabel("متن پرسش یا پاسخ").fill("پرسشی که قرار است حذف شود");
  await s.getByRole("button", { name: "ارسال پرسش" }).click();
  await expect(s.getByText("پرسشی که قرار است حذف شود")).toBeVisible({ timeout: 10000 });

  await s.getByRole("button", { name: "حذف", exact: true }).click();
  await expect(s.getByText("[این پیام حذف شده است]")).toBeVisible({ timeout: 10000 });
  // deleted body is gone
  await expect(s.getByText("پرسشی که قرار است حذف شود")).toHaveCount(0);
  // the tab badge drops back to no badge (0 live comments)
  await expect(s.getByRole("tab", { name: /پرسش و پاسخ/ })).not.toContainText("۱", {
    timeout: 10000,
  });
  await s.context().close();
});
