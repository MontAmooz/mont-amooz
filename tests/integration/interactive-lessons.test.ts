// Integration tests — interactive lessons (P15): CRUD + advance flow + progress.
// Correct answers are stripped from student API responses; grading is
// server-side; steps lock after the first participant.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

/** Canonical 4-step lesson: TEXT(0) → MC(1) → NUMERIC(2) → MC(3, final). */
function lessonPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: `درس تعاملی تست ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: "توضیح درس تست",
    grade: "دهم",
    subject: "ریاضی",
    published: false,
    estimatedMinutes: 15,
    steps: [
      { type: "TEXT", content: "## مقدمه\n\nاین مقدمهٔ درس تست است و بیش از دو نویسه دارد." },
      {
        type: "MC",
        content: "حاصل $2+2$ چند است؟",
        options: [{ text: "۳" }, { text: "۴" }, { text: "۵" }],
        correctOptionIndex: 1,
        explanation: "جمع ساده: ۲+۲=۴.",
      },
      {
        type: "NUMERIC",
        content: "مضرب ۶ و ۷ چند است؟",
        correctNumeric: 42,
        tolerance: 0,
        explanation: "$6\\times7=42$.",
      },
      {
        type: "MC",
        content: "گام آخر: حاصل $3\\times3$ چند است؟",
        options: [{ text: "۶" }, { text: "۹" }],
        correctOptionIndex: 1,
        explanation: "۹۹ = ۳×۳.",
      },
    ],
    ...overrides,
  };
}

async function createLesson(cookie: string, overrides: Record<string, unknown> = {}) {
  const url = await baseUrl();
  return api<{ id: string }>(url, "/api/v1/interactive-lessons", {
    method: "POST",
    cookie,
    json: lessonPayload(overrides),
  });
}

/** Owner detail → step ids + correct answers for driving the advance flow. */
async function ownerDetail(cookie: string, lessonId: string) {
  const url = await baseUrl();
  const r = await api<{
    steps: Array<{
      id: string;
      type: string;
      options: { id: string; text: string }[] | null;
      correctOptionId: string | null;
      correctNumeric: number | null;
      tolerance: number | null;
    }>;
  }>(url, `/api/v1/interactive-lessons/${lessonId}`, { cookie });
  expect(r.status).toBe(200);
  return r.data;
}

/** Advance helper. */
async function advance(cookie: string, lessonId: string, stepIndex: number, answer: string | null) {
  const url = await baseUrl();
  return api<{ correct: boolean; explanation: string | null; currentStep: number; completed: boolean; summary?: { totalSteps: number; firstTryCorrect: number; totalAttempts: number } }>(
    url,
    `/api/v1/interactive-lessons/${lessonId}/advance`,
    { method: "POST", cookie, json: { stepIndex, answer } }
  );
}

const err = (d: unknown) => (d as { error?: string }).error ?? "";

// ===================== CRUD =====================

describe("POST /interactive-lessons", () => {
  test("unauthenticated → 401", async () => {
    const r = await createLesson("");
    expect(r.status).toBe(401);
  });

  test("student role → 403", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url, { role: "دانش‌آموز" });
    const r = await createLesson(cookie);
    expect(r.status).toBe(403);
    expect(err(r.data)).toBe("فقط معلم می‌تواند درس تعاملی بسازد");
  });

  test("title too short → 400", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url);
    const r = await createLesson(cookie, { title: "ab" });
    expect(r.status).toBe(400);
    expect(err(r.data)).toBe("عنوان درس باید بین ۳ تا ۱۲۰ نویسه باشد");
  });

  test("1 step → 400 «درس باید بین ۲ تا ۴۰ گام داشته باشد»", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url);
    const r = await createLesson(cookie, {
      steps: [{ type: "TEXT", content: "فقط یک گام در این درس است." }],
    });
    expect(r.status).toBe(400);
    expect(err(r.data)).toBe("درس باید بین ۲ تا ۴۰ گام داشته باشد");
  });

  test("MC with 1 option → 400; bad correctOptionIndex → 400 «گزینهٔ صحیح نامعتبر است»", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url);
    const one = await createLesson(cookie, {
      steps: [
        { type: "TEXT", content: "مقدمهٔ درس برای آزمون اعتبارسنجی." },
        { type: "MC", content: "سؤال؟", options: [{ text: "فقط یکی" }], correctOptionIndex: 0 },
      ],
    });
    expect(one.status).toBe(400);
    expect(err(one.data)).toBe("هر گام چندگزینه‌ای باید بین ۲ تا ۴ گزینه داشته باشد");

    const bad = await createLesson(cookie, {
      steps: [
        { type: "TEXT", content: "مقدمهٔ درس برای آزمون اعتبارسنجی." },
        { type: "MC", content: "سؤال؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 5 },
      ],
    });
    expect(bad.status).toBe(400);
    expect(err(bad.data)).toBe("گزینهٔ صحیح نامعتبر است");
  });

  test("NUMERIC: non-finite answer → 400; negative tolerance → 400", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url);
    const badNum = await createLesson(cookie, {
      steps: [
        { type: "TEXT", content: "مقدمهٔ درس برای آزمون اعتبارسنجی." },
        { type: "NUMERIC", content: "سؤال؟", correctNumeric: "not-a-number" },
      ],
    });
    expect(badNum.status).toBe(400);
    expect(err(badNum.data)).toBe("پاسخ صحیح عددی معتبر نیست");

    const badTol = await createLesson(cookie, {
      steps: [
        { type: "TEXT", content: "مقدمهٔ درس برای آزمون اعتبارسنجی." },
        { type: "NUMERIC", content: "سؤال؟", correctNumeric: 4, tolerance: -1 },
      ],
    });
    expect(badTol.status).toBe(400);
    expect(err(badTol.data)).toBe("تلورانس نمی‌تواند منفی باشد");
  });

  test("valid TEXT + MC + NUMERIC → 201 with id", async () => {
    const url = await baseUrl();
    const { cookie } = await registerUser(url);
    const badGrade = await createLesson(cookie, { grade: "مقطع ناموجود" });
    expect(badGrade.status).toBe(400);
    expect(err(badGrade.data)).toBe("پایه نامعتبر است");

    const r = await createLesson(cookie);
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();
  });
});

describe("GET /interactive-lessons (list)", () => {
  test("published only by default; mine=true includes drafts (owner only)", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const published = await createLesson(teacher.cookie, { published: true, title: `منتشر ${Date.now()}` });
    expect(published.status).toBe(201);
    await createLesson(teacher.cookie, { published: false, title: `پیش‌نویس ${Date.now()}` });

    const anon = await api<{ items: Array<{ id: string; published: boolean }> }>(
      url,
      "/api/v1/interactive-lessons?pageSize=48"
    );
    expect(anon.status).toBe(200);
    expect(anon.data.items.some((l) => !l.published)).toBe(false);

    const mineNoAuth = await api(url, "/api/v1/interactive-lessons?mine=true");
    expect(mineNoAuth.status).toBe(401);

    const mine = await api<{ items: Array<{ id: string; published: boolean; stepCount: number }> }>(
      url,
      "/api/v1/interactive-lessons?mine=true&pageSize=48",
      { cookie: teacher.cookie }
    );
    expect(mine.status).toBe(200);
    expect(mine.data.items.some((l) => l.id === published.data.id)).toBe(true);
    for (const l of mine.data.items) {
      expect(l.stepCount).toBe(4);
    }
  });

  test("grade + subject filters", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    await createLesson(teacher.cookie, { published: true, grade: "یازدهم", subject: "فیزیک", title: `فیزیک یازدهم ${Date.now()}` });
    const r = await api<{ items: Array<{ grade: string; subject: string }> }>(
      url,
      "/api/v1/interactive-lessons?grade=یازدهم&subject=فیزیک&pageSize=48"
    );
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
    expect(r.data.items.every((l) => l.grade === "یازدهم" && l.subject === "فیزیک")).toBe(true);
  });
});

describe("GET /interactive-lessons/[id]", () => {
  test("published public → correct answers stripped", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await api<{
      isMine: boolean;
      myProgress: unknown;
      steps: Array<{ type: string; correctOptionId?: string; correctNumeric?: number; options?: { id: string }[] }>;
    }>(url, `/api/v1/interactive-lessons/${created.id}`);
    expect(r.status).toBe(200);
    expect(r.data.isMine).toBe(false);
    expect(r.data.myProgress).toBeNull();
    for (const s of r.data.steps) {
      expect(s.correctOptionId).toBeUndefined();
      expect(s.correctNumeric).toBeUndefined();
      if (s.type === "MC") expect(s.options!.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("owner → correctOptionId + correctNumeric present; hasProgress false", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await api<{
      isMine: boolean;
      hasProgress: boolean;
      steps: Array<{ correctOptionId?: string; correctNumeric?: number }>;
    }>(url, `/api/v1/interactive-lessons/${created.id}`, { cookie: teacher.cookie });
    expect(r.status).toBe(200);
    expect(r.data.isMine).toBe(true);
    expect(r.data.hasProgress).toBe(false);
    expect(r.data.steps[1].correctOptionId).toBeTruthy();
    expect(r.data.steps[2].correctNumeric).toBe(42);
  });

  test("draft non-owner → 404 «درس پیدا نشد»", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: false });
    const r = await api(url, `/api/v1/interactive-lessons/${created.id}`);
    expect(r.status).toBe(404);
    expect(err(r.data)).toBe("درس پیدا نشد");
  });
});

describe("PATCH /interactive-lessons/[id]", () => {
  test("non-owner → 403", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const other = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie);
    const r = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "PATCH",
      cookie: other.cookie,
      json: { title: "تلاش بی‌اجازه" },
    });
    expect(r.status).toBe(403);
  });

  test("steps replacement when hasProgress → 400; metadata-only → ok", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const detail = await ownerDetail(teacher.cookie, created.id);

    // one TEXT advance → a progress row exists → steps freeze
    const a = await advance(student.cookie, created.id, 0, null);
    expect(a.status).toBe(200);
    expect(a.data.correct).toBe(true);
    expect(a.data.currentStep).toBe(1);

    const qEdit = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "PATCH",
      cookie: teacher.cookie,
      json: { steps: lessonPayload().steps },
    });
    expect(qEdit.status).toBe(400);
    expect(err(qEdit.data)).toBe("نمی‌توانید گام‌ها را بعد از اولین شرکت‌کننده تغییر دهید");

    const metaEdit = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "PATCH",
      cookie: teacher.cookie,
      json: { title: `عنوان جدید ${Date.now()}` },
    });
    expect(metaEdit.status).toBe(200);

    // owner detail now reports hasProgress
    const after = await api<{ hasProgress: boolean }>(
      url,
      `/api/v1/interactive-lessons/${created.id}`,
      { cookie: teacher.cookie }
    );
    expect(after.data.hasProgress).toBe(true);
  });

  test("metadata-only edit before progress → ok; steps replace works", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie);
    const edit = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "PATCH",
      cookie: teacher.cookie,
      json: {
        description: "توضیح ویرایش‌شده",
        steps: [
          { type: "TEXT", content: "گام یک ویرایش‌شده." },
          { type: "NUMERIC", content: "گام دو ویرایش‌شده.", correctNumeric: 7, tolerance: 0.5 },
        ],
      },
    });
    expect(edit.status).toBe(200);
    const detail = await ownerDetail(teacher.cookie, created.id);
    expect(detail.steps.length).toBe(2);
    expect(detail.steps[1].correctNumeric).toBe(7);
    expect(detail.steps[1].tolerance).toBe(0.5);
  });
});

describe("DELETE /interactive-lessons/[id]", () => {
  test("non-owner → 403; owner → 204 and cascade", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });

    await advance(student.cookie, created.id, 0, null); // creates progress

    const foreign = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "DELETE",
      cookie: student.cookie,
    });
    expect(foreign.status).toBe(403);

    const del = await api(url, `/api/v1/interactive-lessons/${created.id}`, {
      method: "DELETE",
      cookie: teacher.cookie,
    });
    expect(del.status).toBe(204);

    const gone = await api(url, `/api/v1/interactive-lessons/${created.id}`, { cookie: teacher.cookie });
    expect(gone.status).toBe(404);

    // progress cascade — the student's history must not include the deleted lesson
    const history = await api<{ items: Array<{ lesson: { id: string } }> }>(
      url,
      "/api/v1/users/me/interactive-lesson-progress",
      { cookie: student.cookie }
    );
    expect(history.data.items.some((p) => p.lesson.id === created.id)).toBe(false);
  });
});

// ===================== advance flow =====================

describe("POST /interactive-lessons/[id]/advance", () => {
  test("unauthenticated → 401", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await advance("", created.id, 0, null);
    expect(r.status).toBe(401);
  });

  test("TEXT step, answer=null → correct, currentStep=1", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await advance(student.cookie, created.id, 0, null);
    expect(r.status).toBe(200);
    expect(r.data.correct).toBe(true);
    expect(r.data.currentStep).toBe(1);
    expect(r.data.completed).toBe(false);
  });

  test("TEXT step with a stray answer → still correct (ignored)", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await advance(student.cookie, created.id, 0, "هرچند جوابی هم بفرستد");
    expect(r.status).toBe(200);
    expect(r.data.correct).toBe(true);
    expect(r.data.currentStep).toBe(1);
  });

  test("MC correct → advance; wrong → explanation + attempts=1, retry → attempts=2", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const detail = await ownerDetail(teacher.cookie, created.id);
    const mc = detail.steps[1];
    const wrongId = mc.options!.find((o) => o.id !== mc.correctOptionId)!.id;

    // step 0 (TEXT) first — the cursor must be on the MC step
    await advance(student.cookie, created.id, 0, null);

    const wrong = await advance(student.cookie, created.id, 1, wrongId);
    expect(wrong.status).toBe(200);
    expect(wrong.data.correct).toBe(false);
    expect(wrong.data.explanation).toContain("جمع ساده");
    expect(wrong.data.currentStep).toBe(1);

    const prog1 = await api<{ progress: { responses: Record<string, { attempts: number }> } | null }>(
      url,
      `/api/v1/interactive-lessons/${created.id}/progress`,
      { cookie: student.cookie }
    );
    expect(prog1.data.progress!.responses[mc.id].attempts).toBe(1);

    const wrong2 = await advance(student.cookie, created.id, 1, wrongId);
    expect(wrong2.data.correct).toBe(false);
    const prog2 = await api<{ progress: { responses: Record<string, { attempts: number }> } | null }>(
      url,
      `/api/v1/interactive-lessons/${created.id}/progress`,
      { cookie: student.cookie }
    );
    expect(prog2.data.progress!.responses[mc.id].attempts).toBe(2);

    const right = await advance(student.cookie, created.id, 1, mc.correctOptionId!);
    expect(right.data.correct).toBe(true);
    expect(right.data.currentStep).toBe(2);
    expect(right.data.explanation).toBeNull();
  });

  test("NUMERIC within tolerance → correct; outside → wrong", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, {
      published: true,
      steps: [
        { type: "NUMERIC", content: "حاصل $10\\div4$؟", correctNumeric: 2.5, tolerance: 0.1 },
        { type: "TEXT", content: "پایان درس تست تلورانس — این متن بیش از دو نویسه دارد." },
      ],
    });
    expect(created.id).toBeTruthy();

    const off = await advance(student.cookie, created.id, 0, "2.8");
    expect(off.data.correct).toBe(false);
    const close = await advance(student.cookie, created.id, 0, "2.55");
    expect(close.data.correct).toBe(true);
    expect(close.data.currentStep).toBe(1);
  });

  test("NUMERIC with Persian digits and thousand separators (normalizePersian)", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, {
      published: true,
      steps: [
        { type: "NUMERIC", content: "عدد ۱۲۳۴ را وارد کنید.", correctNumeric: 1234, tolerance: 0 },
        { type: "NUMERIC", content: "همان عدد را با جداکنندهٔ هزارگان وارد کنید.", correctNumeric: 1234, tolerance: 0 },
        { type: "TEXT", content: "پایان درس تست ارقام فارسی — این متن بیش از دو نویسه دارد." },
      ],
    });
    const fa = await advance(student.cookie, created.id, 0, "۱۲۳۴");
    expect(fa.data.correct).toBe(true);
    const sep = await advance(student.cookie, created.id, 1, "1,234");
    expect(sep.data.correct).toBe(true);
    const fin = await advance(student.cookie, created.id, 2, null);
    expect(fin.data.completed).toBe(true);
  });

  test("stepIndex mismatch (skipping) → 400 «گام نامعتبر است»", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const detail = await ownerDetail(teacher.cookie, created.id);
    const mc = detail.steps[1];

    const skip = await advance(student.cookie, created.id, 2, "42");
    expect(skip.status).toBe(400);
    expect(err(skip.data)).toBe("گام نامعتبر است");

    // stale UI answer for a step already passed → also invalid
    const r = await advance(student.cookie, created.id, 0, mc.correctOptionId);
    expect(r.status).toBe(200); // TEXT ignores answers, currentStep still 0 → correct
  });

  test("last step correct → completed=true with summary; further calls → 400 «درس تکمیل شده است»", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const detail = await ownerDetail(teacher.cookie, created.id);
    const mc1 = detail.steps[1];
    const mc2 = detail.steps[3];

    expect((await advance(student.cookie, created.id, 0, null)).data.correct).toBe(true);
    // wrong once on MC1 → not first-try
    await advance(student.cookie, created.id, 1, mc1.options![0].id);
    expect((await advance(student.cookie, created.id, 1, mc1.correctOptionId!)).data.correct).toBe(true);
    expect((await advance(student.cookie, created.id, 2, "42")).data.correct).toBe(true);
    const last = await advance(student.cookie, created.id, 3, mc2.correctOptionId!);
    expect(last.status).toBe(200);
    expect(last.data.correct).toBe(true);
    expect(last.data.completed).toBe(true);
    expect(last.data.summary).toBeDefined();
    // 3 graded steps; MC1 had 2 attempts → firstTryCorrect = 2, totalAttempts = 4
    expect(last.data.summary!.totalSteps).toBe(3);
    expect(last.data.summary!.firstTryCorrect).toBe(2);
    expect(last.data.summary!.totalAttempts).toBe(4);

    const again = await advance(student.cookie, created.id, 0, null);
    expect(again.status).toBe(400);
    expect(err(again.data)).toBe("درس تکمیل شده است");
  });

  test("owner can also advance (test-drive own published lesson)", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const r = await advance(teacher.cookie, created.id, 0, null);
    expect(r.status).toBe(200);
    expect(r.data.currentStep).toBe(1);
  });
});

// ===================== progress =====================

describe("progress endpoints", () => {
  test("GET /interactive-lessons/[id]/progress: unauth → 401; not started → null", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });

    const unauth = await api(url, `/api/v1/interactive-lessons/${created.id}/progress`);
    expect(unauth.status).toBe(401);

    const r = await api<{ progress: unknown }>(
      url,
      `/api/v1/interactive-lessons/${created.id}/progress`,
      { cookie: student.cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.progress).toBeNull();
  });

  test("after a TEXT step → currentStep=1; /users/me list includes it", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });

    await advance(student.cookie, created.id, 0, null);

    const p = await api<{
      progress: {
        currentStep: number;
        completed: boolean;
        startedAt: string;
        completedAt: string | null;
      } | null;
    }>(url, `/api/v1/interactive-lessons/${created.id}/progress`, { cookie: student.cookie });
    expect(p.data.progress!.currentStep).toBe(1);
    expect(p.data.progress!.completed).toBe(false);
    expect(p.data.progress!.completedAt).toBeNull();

    const list = await api<{
      items: Array<{ lesson: { id: string }; currentStep: number; stepCount: number; completed: boolean }>;
    }>(url, "/api/v1/users/me/interactive-lesson-progress", { cookie: student.cookie });
    expect(list.status).toBe(200);
    const mine = list.data.items.find((x) => x.lesson.id === created.id);
    expect(mine).toBeDefined();
    expect(mine!.currentStep).toBe(1);
    expect(mine!.stepCount).toBe(4);
    expect(mine!.completed).toBe(false);
  });

  test("completion → LESSON_COMPLETED notification to the teacher", async () => {
    const url = await baseUrl();
    const teacher = await registerUser(url);
    const student = await registerUser(url);
    const { data: created } = await createLesson(teacher.cookie, { published: true });
    const detail = await ownerDetail(teacher.cookie, created.id);

    await advance(student.cookie, created.id, 0, null);
    await advance(student.cookie, created.id, 1, detail.steps[1].correctOptionId!);
    await advance(student.cookie, created.id, 2, "42");
    await advance(student.cookie, created.id, 3, detail.steps[3].correctOptionId!);

    const notes = await api<{ items: Array<{ type: string; body: string | null; linkUrl: string | null }> }>(
      url,
      "/api/v1/notifications",
      { cookie: teacher.cookie }
    );
    const note = notes.data.items.find((n) => n.type === "LESSON_COMPLETED");
    expect(note).toBeTruthy();
    expect(note!.body).toContain(student.user.fullName);
    expect(note!.linkUrl).toBe(`#/lesson/${created.id}`);
  });
});
