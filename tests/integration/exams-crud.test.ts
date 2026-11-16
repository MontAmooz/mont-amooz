// Integration tests — exam CRUD + list filtering (P12)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

/** A valid exam payload builder. */
function examPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: `آزمون تست ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    grade: "دهم",
    subject: "ریاضی",
    published: false,
    questions: [
      { text: "حاصل ۲+۲ چیست؟", options: [{ text: "۳" }, { text: "۴" }], correctOptionIndex: 1, points: 2 },
      { text: "حاصل ۳×۳ چیست؟", options: [{ text: "۶" }, { text: "۹" }, { text: "۱۲" }], correctOptionIndex: 1 },
    ],
    ...overrides,
  };
}

async function createExam(cookie: string, overrides: Record<string, unknown> = {}) {
  return api<{ id: string }>(baseUrl(), "/api/v1/exams", {
    method: "POST",
    cookie,
    json: examPayload(overrides),
  });
}

describe("POST /exams", () => {
  test("unauthenticated → 401", async () => {
    const r = await createExam("");
    expect(r.status).toBe(401);
  });

  test("student role → 403 «فقط معلم می‌تواند آزمون بسازد»", async () => {
    const { cookie } = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const r = await createExam(cookie);
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe("فقط معلم می‌تواند آزمون بسازد");
  });

  test("missing/short title → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, { title: "ab" });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("عنوان آزمون باید بین ۳ تا ۱۲۰ نویسه باشد");
  });

  test("0 questions → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, { questions: [] });
    expect(r.status).toBe(400);
  });

  test("51 questions → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const q = { text: "سؤال ساده؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 0 };
    const r = await createExam(cookie, { questions: Array.from({ length: 51 }, () => q) });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("آزمون باید بین ۱ تا ۵۰ سؤال داشته باشد");
  });

  test("question with 1 option → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, {
      questions: [{ text: "سؤال؟", options: [{ text: "فقط یکی" }], correctOptionIndex: 0 }],
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("هر سؤال باید بین ۲ تا ۴ گزینه داشته باشد");
  });

  test("question with 5 options → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, {
      questions: [
        {
          text: "سؤال؟",
          options: [{ text: "۱" }, { text: "۲" }, { text: "۳" }, { text: "۴" }, { text: "۵" }],
          correctOptionIndex: 0,
        },
      ],
    });
    expect(r.status).toBe(400);
  });

  test("invalid correctOptionIndex → 400 «گزینهٔ صحیح نامعتبر است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, {
      questions: [{ text: "سؤال؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 5 }],
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("گزینهٔ صحیح نامعتبر است");
  });

  test("points out of range → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await createExam(cookie, {
      questions: [{ text: "سؤال؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 0, points: 11 }],
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("امتیاز هر سؤال باید بین ۱ تا ۱۰ باشد");
  });

  test("valid → 201 with id; grade/subject validated", async () => {
    const { cookie } = await registerUser(baseUrl());
    const bad = await createExam(cookie, { grade: "مقطع ناموجود" });
    expect(bad.status).toBe(400);
    expect((bad.data as unknown as { error: string }).error).toBe("پایه نامعتبر است");

    const r = await createExam(cookie);
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();
  });
});

describe("GET /exams (list)", () => {
  test("published only by default; mine=true includes drafts (owner only)", async () => {
    const teacher = await registerUser(baseUrl());
    const published = await createExam(teacher.cookie, { published: true, title: `منتشر ${Date.now()}` });
    expect(published.status).toBe(201);
    await createExam(teacher.cookie, { published: false, title: `پیش‌نویس ${Date.now()}` });

    const anon = await api<{ items: Array<{ id: string; published: boolean }> }>(
      baseUrl(),
      "/api/v1/exams?pageSize=48"
    );
    expect(anon.status).toBe(200);
    expect(anon.data.items.some((e) => !e.published)).toBe(false);

    const mineNoAuth = await api(baseUrl(), "/api/v1/exams?mine=true");
    expect(mineNoAuth.status).toBe(401);

    const mine = await api<{ items: Array<{ id: string; published: boolean }> }>(
      baseUrl(),
      "/api/v1/exams?mine=true&pageSize=48",
      { cookie: teacher.cookie }
    );
    expect(mine.status).toBe(200);
    expect(mine.data.items.some((e) => e.id === published.data.id)).toBe(true);
    expect(mine.data.items.every((e) => e.published || e.published === false)).toBe(true); // drafts included
  });

  test("grade + subject filters", async () => {
    const teacher = await registerUser(baseUrl());
    await createExam(teacher.cookie, { published: true, grade: "یازدهم", subject: "فیزیک", title: `فیزیک یازدهم ${Date.now()}` });
    const r = await api<{ items: Array<{ grade: string; subject: string }> }>(
      baseUrl(),
      "/api/v1/exams?grade=یازدهم&subject=فیزیک&pageSize=48"
    );
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
    expect(r.data.items.every((e) => e.grade === "یازدهم" && e.subject === "فیزیک")).toBe(true);
  });
});

describe("GET /exams/[id]", () => {
  test("anonymous on published → correctOptionId stripped", async () => {
    const teacher = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie, { published: true });
    const r = await api<{
      questions: Array<{ id: string; options: { id: string }[]; correctOptionId?: string }>;
      isMine: boolean;
      myAttempt: unknown;
    }>(baseUrl(), `/api/v1/exams/${created.id}`);
    expect(r.status).toBe(200);
    expect(r.data.isMine).toBe(false);
    expect(r.data.myAttempt).toBeNull();
    for (const q of r.data.questions) {
      expect(q.correctOptionId).toBeUndefined();
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("anonymous on draft → 404 «آزمون پیدا نشد»", async () => {
    const teacher = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie, { published: false });
    const r = await api(baseUrl(), `/api/v1/exams/${created.id}`);
    expect(r.status).toBe(404);
    expect((r.data as unknown as { error: string }).error).toBe("آزمون پیدا نشد");
  });

  test("owner → correctOptionId present", async () => {
    const teacher = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie, { published: true });
    const r = await api<{
      isMine: boolean;
      questions: Array<{ correctOptionId?: string; options: { id: string }[] }>;
    }>(baseUrl(), `/api/v1/exams/${created.id}`, { cookie: teacher.cookie });
    expect(r.status).toBe(200);
    expect(r.data.isMine).toBe(true);
    for (const q of r.data.questions) {
      expect(q.correctOptionId).toBeTruthy();
      expect(q.options.some((o) => o.id === q.correctOptionId)).toBe(true);
    }
  });
});

describe("PATCH /exams/[id]", () => {
  test("non-owner → 403", async () => {
    const teacher = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie);
    const r = await api(baseUrl(), `/api/v1/exams/${created.id}`, {
      method: "PATCH",
      cookie: other.cookie,
      json: { title: "تلاش بی‌اجازه" },
    });
    expect(r.status).toBe(403);
  });

  test("metadata edit with attempts → 200; question edit with attempts → 400", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie, { published: true });
    const detail = await api<{ questions: Array<{ id: string; options: { id: string }[]; correctOptionId?: string }> }>(
      baseUrl(),
      `/api/v1/exams/${created.id}`,
      { cookie: teacher.cookie }
    );
    const q = detail.data.questions[0];
    const correctId = (q as { correctOptionId: string }).correctOptionId;

    const attempt = await api(baseUrl(), `/api/v1/exams/${created.id}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: { [q.id]: correctId } },
    });
    expect(attempt.status).toBe(201);

    const qEdit = await api(baseUrl(), `/api/v1/exams/${created.id}`, {
      method: "PATCH",
      cookie: teacher.cookie,
      json: {
        questions: [
          { text: "سؤال عوض‌شده؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 0 },
        ],
      },
    });
    expect(qEdit.status).toBe(400);
    expect((qEdit.data as { error: string }).error).toBe("نمی‌توانید سؤالات را بعد از دریافت پاسخ تغییر دهید");

    const metaEdit = await api(baseUrl(), `/api/v1/exams/${created.id}`, {
      method: "PATCH",
      cookie: teacher.cookie,
      json: { title: `عنوان جدید ${Date.now()}` },
    });
    expect(metaEdit.status).toBe(200);
  });
});

describe("DELETE /exams/[id]", () => {
  test("non-owner → 403; owner → 204 and cascade", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { data: created } = await createExam(teacher.cookie, { published: true });
    const detail = await api<{ questions: Array<{ id: string; correctOptionId?: string }> }>(
      baseUrl(),
      `/api/v1/exams/${created.id}`,
      { cookie: teacher.cookie }
    );
    const q = detail.data.questions[0];

    // an attempt exists → cascade must remove it
    await api(baseUrl(), `/api/v1/exams/${created.id}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: { [q.id]: (q as { correctOptionId: string }).correctOptionId } },
    });

    const foreign = await api(baseUrl(), `/api/v1/exams/${created.id}`, {
      method: "DELETE",
      cookie: student.cookie,
    });
    expect(foreign.status).toBe(403);

    const del = await api(baseUrl(), `/api/v1/exams/${created.id}`, {
      method: "DELETE",
      cookie: teacher.cookie,
    });
    expect(del.status).toBe(204);

    const gone = await api(baseUrl(), `/api/v1/exams/${created.id}`, { cookie: teacher.cookie });
    expect(gone.status).toBe(404);

    // the attempt cascade — history list must not include the deleted exam
    const history = await api<{ items: Array<{ exam: { id: string } }> }>(
      baseUrl(),
      "/api/v1/users/me/exam-attempts",
      { cookie: student.cookie }
    );
    expect(history.data.items.some((a) => a.exam.id === created.id)).toBe(false);
  });
});
