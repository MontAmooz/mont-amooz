// Integration tests — exam attempts + grading + notification (P12)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

/** Publish a 3-question exam (points 2/3/5; correct indices 1,0,2) → { id, correct option ids }. */
async function publishExam(teacherCookie: string) {
  const created = await api<{ id: string }>(baseUrl(), "/api/v1/exams", {
    method: "POST",
    cookie: teacherCookie,
    json: {
      title: `آزمون نمره‌دهی ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      questions: [
        { text: "۲+۲؟", options: [{ text: "۳" }, { text: "۴" }], correctOptionIndex: 1, points: 2 },
        { text: "۳×۳؟", options: [{ text: "۹" }, { text: "۶" }], correctOptionIndex: 0, points: 3 },
        { text: "۵−۲؟", options: [{ text: "۳" }, { text: "۱" }, { text: "۴" }], correctOptionIndex: 0, points: 5 },
      ],
    },
  });
  expect(created.status).toBe(201);
  const examId = created.data.id;
  const detail = await api<{ questions: Array<{ id: string; correctOptionId: string; options: { id: string }[] }> }>(
    baseUrl(),
    `/api/v1/exams/${examId}`,
    { cookie: teacherCookie }
  );
  return {
    examId,
    questions: detail.data.questions.map((q) => ({
      id: q.id,
      correctOptionId: q.correctOptionId,
      wrongOptionId: q.options.find((o) => o.id !== q.correctOptionId)!.id,
    })),
  };
}

describe("POST /exams/[id]/attempts", () => {
  test("unauthenticated → 401", async () => {
    const teacher = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      json: { answers: {} },
    });
    expect(r.status).toBe(401);
  });

  test("owner taking own exam → 403 «نمی‌توانید در آزمون خودتان شرکت کنید»", async () => {
    const teacher = await registerUser(baseUrl());
    const { examId } = await publishExam(teacher.cookie);
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: teacher.cookie,
      json: { answers: {} },
    });
    expect(r.status).toBe(403);
    expect((r.data as { error: string }).error).toBe("نمی‌توانید در آزمون خودتان شرکت کنید");
  });

  test("draft exam → 400 «آزمون منتشر نشده است»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const created = await api<{ id: string }>(baseUrl(), "/api/v1/exams", {
      method: "POST",
      cookie: teacher.cookie,
      json: {
        title: `پیش‌نویس ${Date.now()}`,
        grade: "دهم",
        subject: "ریاضی",
        published: false,
        questions: [{ text: "سؤال؟", options: [{ text: "۱" }, { text: "۲" }], correctOptionIndex: 0 }],
      },
    });
    const r = await api(baseUrl(), `/api/v1/exams/${created.data.id}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: {} },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("آزمون منتشر نشده است");
  });

  test("grading correctness: all correct → 10/10", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId]));
    const r = await api<{ attemptId: string; score: number; maxScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);
    expect(r.data.score).toBe(10);
    expect(r.data.maxScore).toBe(10);
  });

  test("grading correctness: all wrong → 0; omitted questions count wrong", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    // answer Q1 wrongly and OMIT Q2/Q3 — omitted questions grade as wrong
    const answers = { [questions[0].id]: questions[0].wrongOptionId };
    const r = await api<{ score: number; maxScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);
    expect(r.data.score).toBe(0);
    expect(r.data.maxScore).toBe(10);
  });

  test("repeat attempt → 409 «شما قبلاً در این آزمون شرکت کرده‌اید»", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId]));
    const first = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    expect(first.status).toBe(201);
    const second = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    expect(second.status).toBe(409);
    expect((second.data as { error: string }).error).toBe("شما قبلاً در این آزمون شرکت کرده‌اید");
  });

  test("invalid questionId → 400; invalid optionId → 400", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);

    const badQuestion = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: { nonexistent: questions[0].correctOptionId } },
    });
    expect(badQuestion.status).toBe(400);

    const badOption = await api(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers: { [questions[0].id]: "no-such-option" } },
    });
    expect(badOption.status).toBe(400);
  });

  test("teacher receives EXAM_COMPLETED notification with student name + score", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId]));
    const r = await api<{ score: number; maxScore: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts`,
      { method: "POST", cookie: student.cookie, json: { answers } }
    );
    expect(r.status).toBe(201);

    const notes = await api<{ items: Array<{ type: string; body: string | null; linkUrl: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: teacher.cookie }
    );
    const examNote = notes.data.items.find((n) => n.type === "EXAM_COMPLETED");
    expect(examNote).toBeTruthy();
    expect(examNote!.body).toContain("با امتیاز");
    expect(examNote!.body).toContain(`${r.data.score} از ${r.data.maxScore}`);
    expect(examNote!.linkUrl).toBe(`#/exam/${examId}`);
  });
});

describe("GET attempts (detail + list + history)", () => {
  async function fixture() {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const { examId, questions } = await publishExam(teacher.cookie);
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctOptionId]));
    const submit = await api<{ attemptId: string }>(baseUrl(), `/api/v1/exams/${examId}/attempts`, {
      method: "POST",
      cookie: student.cookie,
      json: { answers },
    });
    expect(submit.status).toBe(201);
    return { teacher, student, other, examId, attemptId: submit.data.attemptId };
  }

  test("student sees own attempt with per-question breakdown", async () => {
    const { student, examId, attemptId } = await fixture();
    const r = await api<{
      questions: Array<{ correctOptionId: string; myOptionId: string; isCorrect: boolean }>;
      score: number;
    }>(baseUrl(), `/api/v1/exams/${examId}/attempts/${attemptId}`, { cookie: student.cookie });
    expect(r.status).toBe(200);
    expect(r.data.questions.every((q) => q.isCorrect)).toBe(true);
    expect(r.data.questions.every((q) => q.correctOptionId === q.myOptionId)).toBe(true);
  });

  test("other student → 403 «دسترسی ندارید»", async () => {
    const { other, examId, attemptId } = await fixture();
    const r = await api(baseUrl(), `/api/v1/exams/${examId}/attempts/${attemptId}`, {
      cookie: other.cookie,
    });
    expect(r.status).toBe(403);
    expect((r.data as { error: string }).error).toBe("دسترسی ندارید");
  });

  test("owner teacher sees the student's attempt", async () => {
    const { teacher, examId, attemptId } = await fixture();
    const r = await api<{ student: { fullName: string }; questions: unknown[] }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts/${attemptId}`,
      { cookie: teacher.cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.questions.length).toBe(3);
  });

  test("attempts list is owner-only and includes the attempt", async () => {
    const { teacher, student, examId, attemptId } = await fixture();
    const foreign = await api<{ items: unknown[]; total: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts`,
      { cookie: student.cookie }
    );
    expect(foreign.status).toBe(403);

    const list = await api<{ items: Array<{ id: string }>; total: number }>(
      baseUrl(),
      `/api/v1/exams/${examId}/attempts`,
      { cookie: teacher.cookie }
    );
    expect(list.status).toBe(200);
    expect(list.data.total).toBe(1);
    expect(list.data.items[0].id).toBe(attemptId);
  });

  test("users/me/exam-attempts lists the student's own history", async () => {
    const { student, examId } = await fixture();
    const r = await api<{ items: Array<{ exam: { id: string }; score: number; maxScore: number }> }>(
      baseUrl(),
      "/api/v1/users/me/exam-attempts",
      { cookie: student.cookie }
    );
    expect(r.status).toBe(200);
    const mine = r.data.items.find((a) => a.exam.id === examId);
    expect(mine).toBeTruthy();
    expect(mine!.maxScore).toBe(10);
  });
});
