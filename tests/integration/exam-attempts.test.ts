// Integration tests — exam attempts (P14 two-step flow: /start + /submit + /grade)
// MC auto-grading, ESSAY manual grading, server-side timer, notifications.
import { describe, test, expect } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

type ExamFixture = {
  examId: string;
  questions: Array<{
    id: string;
    type: "MC" | "ESSAY";
    correctOptionId: string | null;
    wrongOptionId: string | null;
    points: number;
  }>;
};

/** Publish a 3-question exam (MC/MC/ESSAY, points 2/3/5 = 10). */
async function publishExam(teacherCookie: string, opts: { durationMinutes?: number | null; essay?: boolean } = {}) {
  const hasEssay = opts.essay !== false;
  const created = await api<{ id: string }>(baseUrl(), "/api/v1/exams", {
    method: "POST",
    cookie: teacherCookie,
    json: {
      title: `آزمون P14 ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      durationMinutes: opts.durationMinutes ?? null,
      questions: [
        { type: "MC", text: "۲+۲؟", options: [{ text: "۳" }, { text: "۴" }], correctOptionIndex: 1, points: 2 },
        { type: "MC", text: "۳×۳؟", options: [{ text: "۹" }, { text: "۶" }], correctOptionIndex: 0, points: 3 },
        ...(hasEssay
          ? [{ type: "ESSAY", text: "مشتق را با مثال توضیح دهید.", points: 5 }]
          : [{ type: "MC", text: "۵−۲؟", options: [{ text: "۳" }, { text: "۱" }, { text: "۴" }], correctOptionIndex: 0, points: 5 }]),
      ],
    },
  });
  expect(created.status).toBe(201);
  const examId = created.data.id;
  const detail = await api<{
    questions: Array<{
      id: string;
      type: string;
      correctOptionId: string | null;
      options: Array<{ id: string }> | null;
    }>;
  }>(baseUrl(), `/api/v1/exams/${examId}`, { cookie: teacherCookie });
  return {
    examId,
    questions: detail.data.questions.map((q) => ({
      id: q.id,
      type: q.type as "MC" | "ESSAY",
      correctOptionId: q.correctOptionId,
      wrongOptionId: q.options ? (q.options.find((o) => o.id !== q.correctOptionId)?.id ?? null) : null,
      points: 0,
    })),
  };
}

/** Start an attempt for a student → { attemptId }. */
async function startAttempt(studentCookie: string, examId: string) {
  return api<{ attemptId: string; startedAt: string; durationMinutes: number | null; serverNow: number }>(
    baseUrl(),
    `/api/v1/exams/${examId}/attempts/start`,
    { method: "POST", cookie: studentCookie }
  );
}

describe("POST /exams/[id]/attempts/start", () => {
  test("unauthenticated → 401", async () => {
    const teacher = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const r = await startAttempt("", examId);
    expect(r.status).toBe(401);
  });

  test("owner taking own exam → 403", async () => {
    const teacher = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const r = await startAttempt(teacher.cookie, examId);
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe("نمی‌توانید در آزمون خودتان شرکت کنید");
  });

  test("valid → 201 with attemptId + durationMinutes + serverNow", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie, { durationMinutes: 45 });
    const r = await startAttempt(student.cookie, examId);
    expect(r.status).toBe(201);
    expect(r.data.attemptId).toBeTruthy();
    expect(r.data.durationMinutes).toBe(45);
    expect(r.data.serverNow).toBeGreaterThan(0);
    expect(new Date(r.data.startedAt).getTime()).toBeGreaterThan(0);
  });

  test("exam without timer → durationMinutes null", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie, { durationMinutes: null });
    const r = await startAttempt(student.cookie, examId);
    expect(r.status).toBe(201);
    expect(r.data.durationMinutes).toBeNull();
  });

  test("repeat start → 409 «شما قبلاً در این آزمون شرکت کرده‌اید»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    expect((await startAttempt(student.cookie, examId)).status).toBe(201);
    const second = await startAttempt(student.cookie, examId);
    expect(second.status).toBe(409);
    expect((second.data as unknown as { error: string }).error).toBe("شما قبلاً در این آزمون شرکت کرده‌اید");
  });
});

describe("POST /exams/[id]/attempts/[attemptId]/submit", () => {
  test("unauthenticated → 401", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const start = await startAttempt(student.cookie, examId);
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      json: { answers: {} },
    });
    expect(r.status).toBe(401);
  });

  test("wrong attempt owner → 403 «دسترسی ندارید»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const start = await startAttempt(student.cookie, examId);
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      cookie: other.cookie,
      json: { answers: {} },
    });
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe("دسترسی ندارید");
  });

  test("already submitted → 400 «این آزمون قبلاً ارسال شده است»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie, { essay: false });
    const start = await startAttempt(student.cookie, examId);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId!]));
    const first = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    expect(first.status).toBe(201);
    const second = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    expect(second.status).toBe(400);
    expect((second.data as unknown as { error: string }).error).toBe("این آزمون قبلاً ارسال شده است");
  });

  test("invalid optionId → 400 «پاسخ به گزینهٔ ناموجود»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie, { essay: false });
    const start = await startAttempt(student.cookie, examId);
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: { [questions[0].id]: "no-such-option" } },
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("پاسخ به گزینهٔ ناموجود");
  });

  test("MC-only exam: all correct → GRADED, autoScore=10, manualScore=0", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie, { essay: false });
    const start = await startAttempt(student.cookie, examId);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId!]));
    const r = await api<{ status: string; autoScore: number; maxScore: number; hasEssay: boolean }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);
    expect(r.data.status).toBe("GRADED");
    expect(r.data.autoScore).toBe(10);
    expect(r.data.maxScore).toBe(10);
    expect(r.data.hasEssay).toBe(false);
  });

  test("exam with ESSAY → SUBMITTED, autoScore from MC only, manualScore null", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const start = await startAttempt(student.cookie, examId);
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.type === "MC") answers[q.id] = q.correctOptionId!;
      else answers[q.id] = "پاسخ تشریحی دانش‌آموز";
    }
    const r = await api<{ status: string; autoScore: number; maxScore: number; hasEssay: boolean }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);
    expect(r.data.status).toBe("SUBMITTED");
    expect(r.data.autoScore).toBe(5); // MC points only (2+3)
    expect(r.data.maxScore).toBe(10);
    expect(r.data.hasEssay).toBe(true);
  });

  test("timer expired (startedAt wound back in the throwaway DB) → timeLimitReached true", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie, { durationMinutes: 30, essay: false });
    const start = await startAttempt(student.cookie, examId);

    const dbs = fs
      .readdirSync("/tmp")
      .filter((f) => /^oeg-test-\d+\.db$/.test(f))
      .map((f) => `/tmp/${f}`);
    expect(dbs.length).toBeGreaterThan(0);
    for (const dbPath of dbs) {
      execSync(
        `sqlite3 "${dbPath}" "UPDATE ExamAttempt SET startedAt = datetime('now', '-45 minutes') WHERE id = '${start.data.attemptId}';"`
      );
    }

    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId!]));
    const r = await api<{ timeLimitReached: boolean }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);
    expect(r.data.timeLimitReached).toBe(true);
  });
});

describe("POST /exams/[id]/attempts/[attemptId]/grade", () => {
  async function submittedFixture() {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const essay = questions.find((q) => q.type === "ESSAY")!;
    const start = await startAttempt(student.cookie, examId);
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.type === "MC") answers[q.id] = q.correctOptionId!;
      else answers[q.id] = "پاسخ تشریحی برای تصحیح";
    }
    const submit = await api<{ status: string }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(submit.status).toBe(201);
    return { teacher, student, examId, attemptId: start.data.attemptId, essay };
  }

  test("non-owner → 403 «فقط معلم می‌تواند تصحیح کند»", async () => {
    const { student, examId, attemptId } = await submittedFixture();
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${attemptId}/grade`, {
      method: "POST",
      cookie: student.cookie,
      json: { gradings: [] },
    });
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe("فقط معلم می‌تواند تصحیح کند");
  });

  test("attempt not in SUBMITTED status → 400 «این آزمون در وضعیت تصحیح نیست»", async () => {
    // MC-only exam submits straight to GRADED — grading it again must 400
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie, { essay: false });
    const start = await startAttempt(student.cookie, examId);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId!]));
    await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${start.data.attemptId}/grade`, {
      method: "POST",
      cookie: teacher.cookie,
      json: { gradings: [{ questionId: questions[0].id, awardedPoints: 1 }] },
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("این آزمون در وضعیت تصحیح نیست");
  });

  test("valid ESSAY grading → manualScore set, status GRADED, student notified", async () => {
    const { teacher, student, examId, attemptId, essay } = await submittedFixture();
    const r = await api<{ status: string; manualScore: number; totalScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${attemptId}/grade`,
      {
        method: "POST",
        cookie: teacher.cookie,
        json: {
          gradings: [{ questionId: essay.id, awardedPoints: 4, teacherComment: "خوب بود" }],
        },
      }
    );
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("GRADED");
    expect(r.data.manualScore).toBe(4);
    expect(r.data.totalScore).toBe(9); // 5 MC + 4 essay

    const notes = await api<{ items: Array<{ type: string; body: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: student.cookie }
    );
    const graded = notes.data.items.find((n) => n.type === "EXAM_GRADED");
    expect(graded).toBeTruthy();
    expect(graded!.body).toContain("امتیاز نهایی: 9 از 10");
  });

  test("awardedPoints > question.points → 400", async () => {
    const { teacher, examId, attemptId, essay } = await submittedFixture();
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${attemptId}/grade`, {
      method: "POST",
      cookie: teacher.cookie,
      json: { gradings: [{ questionId: essay.id, awardedPoints: 99 }] },
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe(
      "امتیاز هر سؤال باید بین ۰ تا سقف همان سؤال باشد"
    );
  });

  test("awarding full essay points → GRADED with score = maxScore", async () => {
    const { teacher, student, examId, attemptId, essay } = await submittedFixture();
    const r = await api<{ status: string; totalScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${attemptId}/grade`,
      {
        method: "POST",
        cookie: teacher.cookie,
        json: { gradings: [{ questionId: essay.id, awardedPoints: 5 }] },
      }
    );
    expect(r.status).toBe(200);
    expect(r.data.totalScore).toBe(10);

    // student's attempt detail shows the full breakdown
    const detail = await api<{ status: string; totalScore: number; questions: Array<{ type: string; awardedPoints: number | null; teacherComment: string | null }> }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${attemptId}`,
      { cookie: student.cookie }
    );
    expect(detail.data.status).toBe("GRADED");
    expect(detail.data.totalScore).toBe(10);
    const essayRow = detail.data.questions.find((q) => q.type === "ESSAY");
    expect(essayRow?.awardedPoints).toBe(5);
    expect(essayRow?.teacherComment).toBeNull();
  });

  test("awarding 0 → GRADED with score = autoScore only", async () => {
    const { teacher, examId, attemptId } = await submittedFixture();
    const r = await api<{ status: string; manualScore: number; totalScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${attemptId}/grade`,
      {
        method: "POST",
        cookie: teacher.cookie,
        json: { gradings: [{ questionId: "placeholder", awardedPoints: 0 }] },
      }
    );
    // placeholder id → 400 (essay map lookup fails)
    expect(r.status).toBe(400);
  });

  test("notifications: MC-only submit → EXAM_COMPLETED with score; essay submit → pending-essays body", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());

    // MC-only: score in body
    const { examId: mcExamId, questions: mcQs } = await publishExam(teacher.cookie, { essay: false });
    const mcStart = await startAttempt(student.cookie, mcExamId);
    const mcAnswers = Object.fromEntries(mcQs.map((q) => [q.id, q.correctOptionId!]));
    await api(baseUrl(), `/api/v1/exams/${mcExamId}/attempts/${mcStart.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: mcAnswers },
    });
    const notes1 = await api<{ items: Array<{ type: string; body: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: teacher.cookie }
    );
    const mcNote = notes1.data.items.find(
      (n) => n.type === "EXAM_COMPLETED" && n.body?.includes("با امتیاز")
    );
    expect(mcNote).toBeTruthy();
    expect(mcNote!.body).toContain(`امتیاز ${10} از ${10}`);

    // with essay: pending-essays body
    const { examId: essayExamId } = await publishExam(teacher.cookie);
    const essayStart = await startAttempt(student.cookie, essayExamId);
    const essayExamDetail = await api<{ questions: Array<{ id: string; type: string; correctOptionId: string | null; options: Array<{ id: string }> | null }> }>(
      baseUrl(),
      `/api/v1/exams/${essayExamId}`,
      { cookie: teacher.cookie }
    );
    const essayAnswers: Record<string, string> = {};
    for (const q of essayExamDetail.data.questions) {
      essayAnswers[q.id] = q.type === "MC" ? q.correctOptionId! : "متن پاسخ";
    }
    await api(baseUrl(), `/api/v1/exams/${essayExamId}/attempts/${essayStart.data.attemptId}/submit`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: essayAnswers },
    });
    const notes2 = await api<{ items: Array<{ type: string; body: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: teacher.cookie }
    );
    const pendingNote = notes2.data.items.find(
      (n) => n.type === "EXAM_COMPLETED" && n.body?.includes("نیازمند تصحیح")
    );
    expect(pendingNote).toBeTruthy();
  });
});
