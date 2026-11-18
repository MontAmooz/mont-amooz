// P12 — exam builder e2e: teacher creates → student takes + grades → teacher
// sees results → question editing locks after attempts.
import { test, expect } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

test("teacher creates and publishes an exam through the wizard", async ({ page }) => {
  test.setTimeout(120000);
  const founderCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, founderCookie);

  await p.goto("#/exam/new");
  await expect(p.getByRole("heading", { name: "ساخت آزمون جدید" })).toBeVisible({ timeout: 20000 });

  // step 1: مشخصات
  await p.getByLabel("عنوان آزمون").fill(`آزمون E2E ${Date.now()}`);
  await p.getByLabel("پایه").click();
  await p.getByRole("option", { name: "دهم", exact: true }).click();
  await p.getByLabel("درس").click();
  await p.getByRole("option", { name: "ریاضی", exact: true }).click();
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // step 2: سؤالات (2 questions, 2 options each, second option correct)
  const q1 = p.locator("fieldset").nth(0);
  await q1.getByLabel("متن سؤال 1").fill("حاصل ۲+۲ چیست؟");
  await q1.getByLabel("متن گزینهٔ 1 سؤال 1").fill("۳");
  await q1.getByLabel("متن گزینهٔ 2 سؤال 1").fill("۴");
  await q1.getByLabel("گزینهٔ 2 سؤال 1 صحیح است").check();
  await p.getByRole("button", { name: "افزودن سؤال" }).click();
  const q2 = p.locator("fieldset").nth(1);
  await q2.getByLabel("متن سؤال 2").fill("حاصل ۳×۳ چیست؟");
  await q2.getByLabel("متن گزینهٔ 1 سؤال 2").fill("۹");
  await q2.getByLabel("متن گزینهٔ 2 سؤال 2").fill("۶");
  await q2.getByLabel("گزینهٔ 1 سؤال 2 صحیح است").check();

  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();
  await p.getByRole("button", { name: "ایجاد و انتشار آزمون" }).click();

  await expect(p).toHaveURL(/#\/exam\//, { timeout: 20000 });
  await expect(p.getByText("گزینهٔ صحیح").first()).toBeVisible({ timeout: 10000 });

  // the exam appears in the public list
  await p.goto("#/exams");
  await expect(p.getByText(/آزمون E2E/).first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("student takes the exam, sees the graded result, cannot retake", async ({ page }) => {
  test.setTimeout(120000);
  // teacher creates a published exam via API (UI creation covered above)
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const setup = await page.request.post("/api/v1/exams", {
    headers: { Cookie: teacherCookie },
    data: {
      title: `آزمون شرکت E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      questions: [
        { type: "MC", text: "حاصل ۵−۲ چیست؟", options: [{ text: "۳" }, { text: "۷" }], correctOptionIndex: 0, points: 4 },
        { type: "MC", text: "حاصل ۶÷۲ چیست؟", options: [{ text: "۴" }, { text: "۳" }], correctOptionIndex: 1, points: 6 },
      ],
    },
  });
  expect(setup.status()).toBe(201);
  const { id: examId } = (await setup.json()) as { id: string };
  const detail = (await (
    await page.request.get(`/api/v1/exams/${examId}`, { headers: { Cookie: teacherCookie } })
  ).json()) as { questions: Array<{ id: string; options: { id: string; text: string }[] }> };

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const p = await pageWithCookie(page.context().browser()!, studentCookie);
  await p.goto(`#/exam/${examId}`);

  // P14 — start gate: شروع آزمون creates the IN_PROGRESS attempt server-side
  await p.getByRole("button", { name: "شروع آزمون" }).click();
  await p.getByRole("button", { name: "ارسال پاسخ‌ها" }).waitFor({ timeout: 20000 });

  // answer Q1 correctly (۳) and Q2 wrongly (۴) — radios are in document order:
  // Q1-opt1, Q1-opt2, Q2-opt1, Q2-opt2
  await p.getByRole("radio").nth(0).check();
  await p.getByRole("radio").nth(2).check();

  await p.getByRole("button", { name: "ارسال پاسخ‌ها" }).click();
  await expect(p).toHaveURL(new RegExp(`#/exam/${examId}/result/`), { timeout: 20000 });
  await expect(p.getByText("۴ از ۱۰")).toBeVisible({ timeout: 10000 }); // Q1 correct (4) + Q2 wrong (0)

  // retake is blocked on the exam page
  await p.goto(`#/exam/${examId}`);
  await expect(p.getByText("شما در این آزمون شرکت کرده‌اید")).toBeVisible({ timeout: 10000 });
  await expect(p.getByRole("button", { name: "ارسال پاسخ‌ها" })).toHaveCount(0);
  await expect(p.getByRole("button", { name: "مشاهدهٔ پاسخ‌نامه" })).toBeVisible();
  await p.context().close();
});

test("teacher sees the attempt in نتایج and opens the breakdown", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const setup = await page.request.post("/api/v1/exams", {
    headers: { Cookie: teacherCookie },
    data: {
      title: `آزمون نتایج E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      questions: [{ type: "MC", text: "۱۰÷۲ چیست؟", options: [{ text: "۵" }, { text: "۲" }], correctOptionIndex: 0, points: 10 }],
    },
  });
  const { id: examId } = (await setup.json()) as { id: string };
  const detail = (await (
    await page.request.get(`/api/v1/exams/${examId}`, { headers: { Cookie: teacherCookie } })
  ).json()) as { questions: Array<{ id: string; correctOptionId?: string; options: { id: string }[] }> };

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const started = await page.request.post(`/api/v1/exams/${examId}/attempts/start`, {
    headers: { Cookie: studentCookie },
  });
  expect(started.status()).toBe(201);
  const { attemptId } = (await started.json()) as { attemptId: string };
  const submit = await page.request.post(`/api/v1/exams/${examId}/attempts/${attemptId}/submit`, {
    headers: { Cookie: studentCookie },
    data: { answers: { [detail.questions[0].id]: detail.questions[0].options[1].id } }, // wrong on purpose
  });
  expect(submit.status()).toBe(201);

  const p = await pageWithCookie(page.context().browser()!, teacherCookie);
  await p.goto(`#/exam/${examId}`);
  await p.getByRole("tab", { name: /نتایج/ }).click();
  await expect(p.getByText(DEMO_STUDENT.email.split("@")[0])).toHaveCount(0); // email never shown
  await expect(p.getByText("حسین نوری")).toBeVisible({ timeout: 10000 });
  await p.getByRole("button", { name: "مشاهده" }).click();
  await expect(p).toHaveURL(new RegExp(`#/exam/${examId}/result/`), { timeout: 10000 });
  await expect(p.getByText("انتخاب شما")).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("گزینهٔ صحیح").first()).toBeVisible();
  await p.context().close();
});

test("question editing is blocked after an attempt, metadata still editable", async ({ page }) => {
  test.setTimeout(120000);
  const teacherCookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const setup = await page.request.post("/api/v1/exams", {
    headers: { Cookie: teacherCookie },
    data: {
      title: `آزمون قفل E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      questions: [{ type: "MC", text: "۲×۲؟", options: [{ text: "۴" }, { text: "۵" }], correctOptionIndex: 0 }],
    },
  });
  const { id: examId } = (await setup.json()) as { id: string };
  const detail = (await (
    await page.request.get(`/api/v1/exams/${examId}`, { headers: { Cookie: teacherCookie } })
  ).json()) as { questions: Array<{ id: string; correctOptionId?: string }> };

  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const started = await page.request.post(`/api/v1/exams/${examId}/attempts/start`, {
    headers: { Cookie: studentCookie },
  });
  const { attemptId } = (await started.json()) as { attemptId: string };
  await page.request.post(`/api/v1/exams/${examId}/attempts/${attemptId}/submit`, {
    headers: { Cookie: studentCookie },
    data: { answers: { [detail.questions[0].id]: detail.questions[0].correctOptionId! } },
  });

  const p = await pageWithCookie(page.context().browser()!, teacherCookie);
  await p.goto(`#/exam/${examId}/edit`);
  await expect(p.getByText(/این آزمون پاسخ دریافت کرده است/)).toBeVisible({ timeout: 20000 });
  // advance to the سؤالات step — the (disabled) question inputs live there
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();
  await expect(p.getByLabel(/متن سؤال/).first()).toBeDisabled();
  await p.context().close();
});
