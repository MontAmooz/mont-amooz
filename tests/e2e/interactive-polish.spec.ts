// P21 — interactive polish e2e: FILL_BLANK / IMAGE / BRANCHING step types.
// API creates keep the player tests independent of the wizard (lessons.spec
// split), except test 2 which drives the wizard's real image-upload path.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

const SAMPLE_PNG = path.join(__dirname, "fixtures", "sample.png");

type CreateCtx = { lessonId: string; student: import("@playwright/test").Page; studentCookie: string };

/** Create a lesson as the founder through the API, open it as the student. */
async function createLessonAndOpenAsStudent(
  request: import("@playwright/test").APIRequestContext,
  browser: import("@playwright/test").Browser,
  title: string,
  steps: unknown[]
): Promise<CreateCtx> {
  const teacherCookie = await apiLogin(request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const created = await request.post("/api/v1/interactive-lessons", {
    headers: { Cookie: teacherCookie },
    data: { title, description: "درس تعاملی P21", grade: "دهم", subject: "ریاضی", published: true, steps },
  });
  expect(created.status()).toBe(201);
  const lessonId = ((await created.json()) as { id: string }).id;

  const studentCookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const student = await pageWithCookie(browser, studentCookie);
  await student.goto(`#/lesson/${lessonId}`);
  return { lessonId, student, studentCookie };
}

test("FILL_BLANK: student fills every blank and completes the lesson", async ({ page }) => {
  test.setTimeout(120000);
  const { lessonId, student } = await createLessonAndOpenAsStudent(page.request, page.context().browser()!, `درس جای‌خالی E2E ${Date.now()}`, [
    {
      type: "FILL_BLANK",
      content: "مشتق $f(x)=x^3$ برابر ___ است و مشتق $g(x)=x^2$ برابر ___ است.",
      blanks: [
        { correctAnswer: "3x^2", hint: "قاعدهٔ توان" },
        { correctAnswer: "2x" },
      ],
    },
    {
      type: "MC",
      content: "حاصل $2+2$ چند است؟",
      options: [{ text: "۳" }, { text: "۴" }],
      correctOptionIndex: 1,
    },
  ]);

  // step 0: FILL_BLANK — two inputs, hints as placeholders
  const b1 = student.getByLabel("جای خالی ۱");
  const b2 = student.getByLabel("جای خالی ۲");
  await expect(b1).toBeVisible({ timeout: 10000 });
  await expect(b1).toHaveAttribute("placeholder", "قاعدهٔ توان");
  await b1.fill("3x^2");
  await b2.fill("2x");
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await student.getByRole("button", { name: "گام بعدی" }).click();

  // step 1: MC → complete
  await student.getByRole("radio").nth(1).check();
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درس را تکمیل کردید")).toBeVisible({ timeout: 10000 });
  await student.context().close();

  // wrong blank keeps the student on the step with the explanation
  const retry = await page.request.post(`/api/v1/interactive-lessons/${lessonId}/advance`, {
    headers: { Cookie: await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password) },
    data: { stepIndex: 0, answer: JSON.stringify({ nope: "x" }) },
  });
  expect(retry.status()).toBe(400); // lesson completed — retake blocked
});

test("IMAGE: teacher uploads through the wizard; student sees image + caption", async ({ page }) => {
  test.setTimeout(180000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, founderCookie);

  await p.goto("#/lesson/new");
  await expect(p.getByRole("heading", { name: "ساخت درس تعاملی" })).toBeVisible({ timeout: 20000 });
  await p.getByLabel("عنوان درس").fill(`درس تصویری E2E ${Date.now()}`);
  await p.getByLabel("پایه", { exact: true }).click();
  await p.getByRole("option", { name: "دهم", exact: true }).click();
  await p.getByLabel("درس", { exact: true }).click();
  await p.getByRole("option", { name: "ریاضی", exact: true }).click();
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // TEXT(1) + MC(2) prefilled; add IMAGE(3)
  await p.getByLabel("متن گام 1").fill("این مقدمهٔ درس تصویری E2E است و بیش از دو نویسه دارد.");
  await p.getByLabel("متن گام 2").fill("حاصل $2+2$ چند است؟");
  await p.getByLabel("متن گزینهٔ 1 گام 2").fill("۳");
  await p.getByLabel("متن گزینهٔ 2 گام 2").fill("۴");
  await p.getByLabel("گزینهٔ 2 گام 2 صحیح است").check();
  await p.getByLabel("افزودن گام جدید").click();
  await p.getByRole("option", { name: "تصویر" }).click();

  // upload through the real POST /step-images path
  await p.getByLabel("متن گام 3").fill("## تصویر سلول\n\nتصویر زیر را با دقت ببینید.");
  await p.getByLabel("فایل تصویر گام 3").setInputFiles(SAMPLE_PNG);
  await expect(p.locator('img[alt="پیش‌نمایش تصویر گام 3"]')).toBeVisible({ timeout: 20000 });
  await p.getByLabel("توضیح تصویر گام 3").fill("شمای آموزشی برای آزمون E2E");

  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();
  await expect(p.getByRole("heading", { name: "پیش‌نمایش" })).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "ایجاد و انتشار درس" }).click();
  await expect(p).toHaveURL(/#\/lesson\//, { timeout: 20000 });
  const lessonId = p.url().match(/#\/lesson\/([a-z0-9]+)/)?.[1];
  expect(lessonId).toBeTruthy();
  await p.context().close();

  // student: TEXT ادامه → MC بررسی → IMAGE + caption visible → ادامه → complete
  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const s = await pageWithCookie(page.context().browser()!, studentCookie);
  await s.goto(`#/lesson/${lessonId}`);
  await s.getByRole("button", { name: "ادامه" }).click();
  await s.getByRole("radio").nth(1).check();
  await s.getByRole("button", { name: "بررسی" }).click();
  await expect(s.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await s.getByRole("button", { name: "گام بعدی" }).click();

  const img = s.locator("img[alt='شمای آموزشی برای آزمون E2E']");
  await expect(img).toBeVisible({ timeout: 10000 });
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/api\/v1\/step-images\//);
  await s.getByRole("button", { name: "ادامه" }).click();
  await expect(s.getByText("درس را تکمیل کردید")).toBeVisible({ timeout: 10000 });
  await s.context().close();
});

test("BRANCHING: wrong answer jumps to the explanation and loops back to the question", async ({ page }) => {
  test.setTimeout(120000);
  const { student } = await createLessonAndOpenAsStudent(page.request, page.context().browser()!, `درس شرطی E2E ${Date.now()}`, [
    {
      type: "MC",
      content: "کار نیرویی عمود بر جابه‌جایی چقدر است؟",
      options: [{ text: "بیشینه" }, { text: "صفر" }],
      correctOptionIndex: 1,
      nextOnCorrectIndex: 2, // skip the remediation step on the correct path
      nextOnWrongIndex: 1,
      explanation: "پاسخ را با فرمول کار بسنجید.",
    },
    { type: "TEXT", content: "## چرا صفر؟\n\ncos90°=0 — حالا به سؤال برگردید.", nextOnCorrectIndex: 0 },
    { type: "NUMERIC", content: "حاصل $6\\times7$ چند است؟", correctNumeric: 42, tolerance: 0 },
  ]);

  // step 0: wrong answer → the cursor jumps to the explanation (step 1)
  await student.getByRole("radio").nth(0).check();
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText(/برای توضیح بیشتر، به گام بعدی می‌روید/)).toBeVisible({ timeout: 10000 });
  await expect(student.getByText("چرا صفر؟")).toBeVisible({ timeout: 10000 });
  await expect(student.getByText("گام ۲ از ۳")).toBeVisible();

  // dismissible banner
  await student.getByLabel("بستن اعلان مسیر شرطی").click();
  await expect(student.getByText(/برای توضیح بیشتر، به گام بعدی می‌روید/)).toHaveCount(0);

  // explanation advances via its own nextOnCorrect back to the question (step 0)
  await student.getByRole("button", { name: "ادامه" }).click();
  await expect(student.getByRole("radio").nth(0)).toBeVisible({ timeout: 10000 });
  await expect(student.getByText("گام ۱ از ۳")).toBeVisible();

  // now correct → jumps over the explanation straight to the NUMERIC
  await student.getByRole("radio").nth(1).check();
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await student.getByRole("button", { name: "گام بعدی" }).click();
  await expect(student.getByLabel("پاسخ عددی")).toBeVisible({ timeout: 10000 });
  await student.getByLabel("پاسخ عددی").fill("42");
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درس را تکمیل کردید")).toBeVisible({ timeout: 10000 });
  await student.context().close();
});

test("combined lesson: TEXT + FILL_BLANK + IMAGE + MC in one run", async ({ page }) => {
  test.setTimeout(120000);
  const { student } = await createLessonAndOpenAsStudent(page.request, page.context().browser()!, `درس ترکیبی E2E ${Date.now()}`, [
    { type: "TEXT", content: "## مقدمه\n\nچهار نوع گام در یک درس تعاملی E2E." },
    {
      type: "FILL_BLANK",
      content: "مساحت مثلث با قاعده ۸ و ارتفاع ۵ برابر ___ است.",
      blanks: [{ correctAnswer: "20" }],
    },
    { type: "IMAGE", content: "## شکل مثلث", imageUrl: "/courses/cover-geometry.png", imageCaption: "شمای هندسه" },
    {
      type: "MC",
      content: "حاصل $6\\times7$ چند است؟",
      options: [{ text: "۴۲" }, { text: "۳۶" }],
      correctOptionIndex: 0,
    },
  ]);

  await student.getByRole("button", { name: "ادامه" }).click(); // TEXT

  const b1 = student.getByLabel("جای خالی ۱");
  await expect(b1).toBeVisible({ timeout: 10000 });
  await b1.fill("20");
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درست! ✓")).toBeVisible({ timeout: 10000 });
  await student.getByRole("button", { name: "گام بعدی" }).click();

  await expect(student.getByText("شمای هندسه")).toBeVisible({ timeout: 10000 });
  await student.getByRole("button", { name: "ادامه" }).click(); // IMAGE

  await student.getByRole("radio").nth(0).check();
  await student.getByRole("button", { name: "بررسی" }).click();
  await expect(student.getByText("درس را تکمیل کردید")).toBeVisible({ timeout: 10000 });
  await student.context().close();
});
