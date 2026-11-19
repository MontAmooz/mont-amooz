// P15 — interactive lessons e2e: teacher creates through the wizard → student
// plays TEXT/MC/NUMERIC steps → wrong-answer retry → resume after leaving →
// progress visible in the list. API creates keep the player tests independent
// of the wizard (same split as exams.spec).
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

/** Canonical published lesson payload: TEXT(0) → MC(1) → NUMERIC(2). */
function lessonPayload(title: string) {
  return {
    title,
    description: "درس تعاملی E2E — سه گام کوتاه",
    grade: "دهم",
    subject: "ریاضی",
    published: true,
    estimatedMinutes: 10,
    steps: [
      { type: "TEXT", content: "## مقدمه\n\nاین مقدمهٔ درس تعاملی E2E است و بیش از دو نویسه دارد." },
      {
        type: "MC",
        content: "حاصل $2+2$ چند است؟",
        options: [{ text: "۳" }, { text: "۴" }],
        correctOptionIndex: 1,
        explanation: "۲+۲ می‌شود ۴.",
      },
      { type: "NUMERIC", content: "حاصل $6\\times7$ چند است؟", correctNumeric: 42, tolerance: 0 },
    ],
  };
}

async function createLessonViaApi(request: import("@playwright/test").APIRequestContext, cookie: string, title: string) {
  const res = await request.post("/api/v1/interactive-lessons", {
    headers: { Cookie: cookie },
    data: lessonPayload(title),
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("teacher creates and publishes an interactive lesson through the wizard", async ({ page }) => {
  test.setTimeout(120000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, founderCookie);

  await p.goto("#/lesson/new");
  await expect(p.getByRole("heading", { name: "ساخت درس تعاملی" })).toBeVisible({ timeout: 20000 });

  // step 1: مشخصات — exact:true: «درس» substring-matches the title input and
  // the wizard stepper's aria-label otherwise
  await p.getByLabel("عنوان درس").fill(`درس E2E ${Date.now()}`);
  await p.getByLabel("پایه", { exact: true }).click();
  await p.getByRole("option", { name: "دهم", exact: true }).click();
  await p.getByLabel("درس", { exact: true }).click();
  await p.getByRole("option", { name: "ریاضی", exact: true }).click();
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // step 2: گام‌ها — TEXT(1) prefilled, MC(2) prefilled, add NUMERIC(3)
  await p.getByLabel("متن گام 1").fill("این مقدمهٔ درس E2E است و بیش از دو نویسه دارد.");
  await p.getByLabel("متن گام 2").fill("حاصل $2+2$ چند است؟");
  await p.getByLabel("متن گزینهٔ 1 گام 2").fill("۳");
  await p.getByLabel("متن گزینهٔ 2 گام 2").fill("۴");
  await p.getByLabel("گزینهٔ 2 گام 2 صحیح است").check();

  await p.getByLabel("افزودن گام جدید").click();
  await p.getByRole("option", { name: "پاسخ عددی" }).click();
  await p.getByLabel("متن گام 3").fill("حاصل $6\\times7$ چند است؟");
  await p.getByLabel("پاسخ صحیح گام 3").fill("42");

  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();
  await expect(p.getByRole("heading", { name: "پیش‌نمایش" })).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "ایجاد و انتشار درس" }).click();

  // owner panel: correct answers visible
  await expect(p).toHaveURL(/#\/lesson\//, { timeout: 20000 });
  await expect(p.getByText("گزینهٔ صحیح").first()).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("پاسخ صحیح: ۴۲")).toBeVisible();

  // appears in the public list
  await p.goto("#/lessons");
  await expect(p.getByText(/درس E2E/).first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("student completes the lesson step by step to the summary", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const lessonId = await createLessonViaApi(page.request, teacherCookie, `درس تکمیل E2E ${Date.now()}`);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, studentCookie);
  await p.goto(`#/lesson/${lessonId}`);

  // step 0: TEXT → ادامه
  await p.getByRole("button", { name: "ادامه" }).click();

  // step 1: MC — select the correct option (second radio) and بررسی
  await p.getByRole("radio").nth(1).check();
  await p.getByRole("button", { name: "بررسی" }).click();
  await expect(p.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "گام بعدی" }).click();

  // step 2: NUMERIC
  const numeric = p.getByLabel("پاسخ عددی");
  await expect(numeric).toBeVisible({ timeout: 10000 });
  await numeric.fill("42");
  await p.getByRole("button", { name: "بررسی" }).click();

  // completion screen with the summary
  await expect(p.getByText("درس را تکمیل کردید")).toBeVisible({ timeout: 10000 });
  await expect(p.getByRole("button", { name: "بازگشت به درس‌ها" })).toBeVisible();

  // retake is not offered — further advance calls are rejected server-side
  const again = await page.request.post(`/api/v1/interactive-lessons/${lessonId}/advance`, {
    headers: { Cookie: studentCookie },
    data: { stepIndex: 0, answer: null },
  });
  expect(again.status()).toBe(400);
  await p.context().close();
});

test("wrong answer shows the explanation; retry then correct advances", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const lessonId = await createLessonViaApi(page.request, teacherCookie, `درس اشتباه E2E ${Date.now()}`);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, studentCookie);
  await p.goto(`#/lesson/${lessonId}`);

  await p.getByRole("button", { name: "ادامه" }).click();

  // wrong MC answer → explanation banner
  await p.getByRole("radio").nth(0).check(); // ۳ — wrong on purpose
  await p.getByRole("button", { name: "بررسی" }).click();
  await expect(p.getByText("پاسخ درست نبود — دوباره تلاش کنید")).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("۲+۲ می‌شود ۴.")).toBeVisible();
  await expect(p.getByRole("button", { name: "گام بعدی" })).toHaveCount(0);

  // retry → correct → advance gate
  await p.getByRole("button", { name: "تلاش دوباره" }).click();
  await p.getByRole("radio").nth(1).check();
  await p.getByRole("button", { name: "بررسی" }).click();
  await expect(p.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "گام بعدی" }).click();

  await expect(p.getByLabel("پاسخ عددی")).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("student leaves mid-lesson and resumes from the server's current step", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const lessonId = await createLessonViaApi(page.request, teacherCookie, `درس ادامه E2E ${Date.now()}`);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, studentCookie);
  await p.goto(`#/lesson/${lessonId}`);

  // two steps: TEXT + correct MC
  await p.getByRole("button", { name: "ادامه" }).click();
  await p.getByRole("radio").nth(1).check();
  await p.getByRole("button", { name: "بررسی" }).click();
  await expect(p.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "گام بعدی" }).click();
  await expect(p.getByLabel("پاسخ عددی")).toBeVisible({ timeout: 10000 });

  // leave and come back
  await p.goto("#/lessons");
  await p.goto(`#/lesson/${lessonId}`);

  // resume banner + server-truth step (NUMERIC = step 3)
  await expect(p.getByText(/شما این درس را قبلاً شروع کرده بودید/)).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("گام ۳ از ۳")).toBeVisible();
  await expect(p.getByLabel("پاسخ عددی")).toBeVisible();
  // no resume banner on a fresh dismissal
  await p.getByLabel("بستن اعلان ادامه").click();
  await expect(p.getByText(/شما این درس را قبلاً شروع کرده بودید/)).toHaveCount(0);
  await p.context().close();
});

test("in-progress lessons show «در حال یادگیری (X از Y)» in the list", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const lessonId = await createLessonViaApi(page.request, teacherCookie, `درس پیشرفت E2E ${Date.now()}`);

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  // one TEXT step via the API — 1 of 3
  const adv = await page.request.post(`/api/v1/interactive-lessons/${lessonId}/advance`, {
    headers: { Cookie: studentCookie },
    data: { stepIndex: 0, answer: null },
  });
  expect(adv.status()).toBe(200);

  const p = await pageWithCookie(page.context().browser()!, studentCookie);
  await p.goto("#/lessons");
  const card = p.locator("a", { hasText: "درس پیشرفت E2E" }).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.getByText("در حال یادگیری (۱ از ۳)")).toBeVisible();
  await expect(card.getByRole("progressbar")).toBeVisible();
  await p.context().close();
});
