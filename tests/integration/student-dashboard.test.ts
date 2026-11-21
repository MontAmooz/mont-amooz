// Integration tests — student learning dashboard (P18)
// GET /users/me/dashboard: summary counts, up-next and the merged recent
// activity list over the P1/P9/P12/P15 models.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import {
  api,
  createCourse,
  createSlots,
  ensureWalletBalance,
  registerUser,
} from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

type Dashboard = {
  summary: {
    interactiveLessons: { started: number; completed: number; totalAvailable: number };
    exams: { taken: number; averageScorePct: number | null };
    courses: { enrolled: number; averageProgressPct: number | null };
    sessions: { attended: number; upcoming: number };
  };
  upcoming: {
    nextSession: {
      id: string;
      topic: string | null;
      startAt: string;
      teacherName: string;
      studentName: string;
      role: "student" | "teacher";
    } | null;
    nextLesson: { lessonId: string; lessonTitle: string; currentStep: number; totalSteps: number } | null;
  };
  recent: Array<{
    type: "lesson" | "exam" | "course" | "session";
    id: string;
    title: string;
    subtitle: string;
    updatedAt: string;
    linkUrl: string;
    progressPct?: number;
    scorePct?: number;
  }>;
};

const getDashboard = (cookie: string) =>
  api<Dashboard>(baseUrl(), "/api/v1/users/me/dashboard", { cookie });

/** Canonical 4-step lesson (TEXT → MC → NUMERIC → MC), published. */
async function createPublishedLesson(teacherCookie: string) {
  const created = await api<{ id: string }>(baseUrl(), "/api/v1/interactive-lessons", {
    method: "POST",
    cookie: teacherCookie,
    json: {
      title: `درس داشبورد ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: "توضیح درس داشبورد",
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      steps: [
        { type: "TEXT", content: "## مقدمه\n\nاین مقدمهٔ درس تست است و بیش از دو نویسه دارد." },
        {
          type: "MC",
          content: "حاصل $2+2$ چند است؟",
          options: [{ text: "۳" }, { text: "۴" }],
          correctOptionIndex: 1,
          explanation: "جمع ساده.",
        },
        { type: "NUMERIC", content: "مضرب ۶ و ۷ چند است؟", correctNumeric: 42, tolerance: 0 },
        {
          type: "MC",
          content: "حاصل $3\\times3$ چند است؟",
          options: [{ text: "۶" }, { text: "۹" }],
          correctOptionIndex: 1,
        },
      ],
    },
  });
  expect(created.status).toBe(201);
  return created.data.id;
}

/** Publish a 3-question MC-only exam (2+3+5 = 10 points). */
async function publishMcExam(teacherCookie: string) {
  const created = await api<{ id: string }>(baseUrl(), "/api/v1/exams", {
    method: "POST",
    cookie: teacherCookie,
    json: {
      title: `آزمون داشبورد ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      grade: "دهم",
      subject: "ریاضی",
      published: true,
      questions: [
        { type: "MC", text: "۲+۲؟", options: [{ text: "۳" }, { text: "۴" }], correctOptionIndex: 1, points: 2 },
        { type: "MC", text: "۳×۳؟", options: [{ text: "۹" }, { text: "۶" }], correctOptionIndex: 0, points: 3 },
        { type: "MC", text: "۵−۲؟", options: [{ text: "۳" }, { text: "۱" }, { text: "۴" }], correctOptionIndex: 0, points: 5 },
      ],
    },
  });
  expect(created.status).toBe(201);
  const examId = created.data.id;
  const detail = await api<{
    questions: Array<{ id: string; correctOptionId: string | null; options: Array<{ id: string }> | null }>;
  }>(baseUrl(), `/api/v1/exams/${examId}`, { cookie: teacherCookie });
  const questions = detail.data.questions.map((q) => ({
    id: q.id,
    correctOptionId: q.correctOptionId!,
    wrongOptionId: q.options!.find((o) => o.id !== q.correctOptionId)!.id,
  }));
  return { examId, questions };
}

/** Take an exam as a student: start → submit with the given per-question option ids. */
async function takeExam(
  studentCookie: string,
  examId: string,
  answers: Record<string, string>
) {
  const started = await api<{ attemptId: string }>(
    baseUrl(),
    `/api/v1/exams/${examId}/attempts/start`,
    { method: "POST", cookie: studentCookie }
  );
  expect(started.status).toBe(201);
  const submitted = await api(
    baseUrl(),
    `/api/v1/exams/${examId}/attempts/${started.data.attemptId}/submit`,
    { method: "POST", cookie: studentCookie, json: { answers } }
  );
  expect(submitted.status).toBe(201);
}

describe("GET /users/me/dashboard (P18)", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/users/me/dashboard");
    expect(r.status).toBe(401);
  });

  test("fresh user → zeroed summary (except totalAvailable), empty recent, null upcoming", async () => {
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const r = await getDashboard(student.cookie);
    expect(r.status).toBe(200);

    expect(r.data.summary.interactiveLessons.started).toBe(0);
    expect(r.data.summary.interactiveLessons.completed).toBe(0);
    expect(r.data.summary.interactiveLessons.totalAvailable).toBeGreaterThan(0); // 12 seeded
    expect(r.data.summary.exams.taken).toBe(0);
    expect(r.data.summary.exams.averageScorePct).toBeNull();
    expect(r.data.summary.courses.enrolled).toBe(0);
    expect(r.data.summary.courses.averageProgressPct).toBeNull();
    expect(r.data.summary.sessions.attended).toBe(0);
    expect(r.data.summary.sessions.upcoming).toBe(0);
    expect(r.data.recent).toEqual([]);
    expect(r.data.upcoming.nextSession).toBeNull();
    expect(r.data.upcoming.nextLesson).toBeNull();
  });

  test("seeded student hossein → exam attempts counted (GRADED attempts only)", async () => {
    const { loginAs, DEMO_USERS } = await import("../helpers/server");
    const cookie = await loginAs(baseUrl(), DEMO_USERS.student.email, DEMO_USERS.student.password);
    const r = await getDashboard(cookie);
    expect(r.status).toBe(200);
    // seed: 3 MC-only exams attempted by hossein, all GRADED
    expect(r.data.summary.exams.taken).toBeGreaterThanOrEqual(1);
    expect(r.data.summary.exams.averageScorePct).not.toBeNull();
    expect(r.data.recent.some((a) => a.type === "exam")).toBe(true);
  });

  test("starting a lesson → started=1 and a lesson activity first", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const lessonId = await createPublishedLesson(teacher.cookie);

    const adv = await api(baseUrl(), `/api/v1/interactive-lessons/${lessonId}/advance`, {
      method: "POST",
      cookie: student.cookie,
      json: { stepIndex: 0, answer: null }, // TEXT step — cursor moves
    });
    expect(adv.status).toBe(200);

    const r = await getDashboard(student.cookie);
    expect(r.status).toBe(200);
    expect(r.data.summary.interactiveLessons.started).toBe(1);
    expect(r.data.summary.interactiveLessons.completed).toBe(0);
    expect(r.data.recent[0].type).toBe("lesson");
    expect(r.data.recent[0].id).toBe(lessonId);
    expect(r.data.recent[0].linkUrl).toBe(`#/lesson/${lessonId}`);
    // cursor at 1 of 4 steps
    expect(r.data.recent[0].progressPct).toBe(25);
    expect(r.data.upcoming.nextLesson?.lessonId).toBe(lessonId);
    expect(r.data.upcoming.nextLesson?.currentStep).toBe(1);
    expect(r.data.upcoming.nextLesson?.totalSteps).toBe(4);
  });

  test("completing a lesson → completed=1, activity says تکمیل شد, nextLesson null again", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const lessonId = await createPublishedLesson(teacher.cookie);

    // owner detail → step ids + correct answers to drive the full flow
    const detail = await api<{
      steps: Array<{ id: string; type: string; correctOptionId: string | null; options: Array<{ id: string }> | null }>;
    }>(baseUrl(), `/api/v1/interactive-lessons/${lessonId}`, { cookie: teacher.cookie });
    expect(detail.status).toBe(200);
    const steps = detail.data.steps;
    const answerFor = (i: number): string | null => {
      const s = steps[i];
      if (s.type === "TEXT") return null;
      if (s.type === "MC") return s.correctOptionId!;
      return null; // NUMERIC — answered in `answer` field below
    };

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const adv = await api(baseUrl(), `/api/v1/interactive-lessons/${lessonId}/advance`, {
        method: "POST",
        cookie: student.cookie,
        json:
          s.type === "NUMERIC"
            ? { stepIndex: i, answer: "42" }
            : { stepIndex: i, answer: answerFor(i) },
      });
      expect(adv.status).toBe(200);
    }

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.interactiveLessons.started).toBe(1);
    expect(r.data.summary.interactiveLessons.completed).toBe(1);
    expect(r.data.recent[0].subtitle).toContain("تکمیل");
    expect(r.data.recent[0].progressPct).toBe(100);
    expect(r.data.upcoming.nextLesson).toBeNull();
  });

  test("taking an MC exam → taken=1 with averageScorePct and a scored activity", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const { examId, questions } = await publishMcExam(teacher.cookie);

    // one correct, one wrong, one correct → 2+0+5 = 7 of 10 → 70%
    await takeExam(student.cookie, examId, {
      [questions[0].id]: questions[0].correctOptionId,
      [questions[1].id]: questions[1].wrongOptionId,
      [questions[2].id]: questions[2].correctOptionId,
    });

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.exams.taken).toBe(1);
    expect(r.data.summary.exams.averageScorePct).toBe(70);
    const examActivity = r.data.recent.find((a) => a.type === "exam");
    expect(examActivity).toBeTruthy();
    expect(examActivity!.id).toBe(examId);
    expect(examActivity!.scorePct).toBe(70);
    expect(examActivity!.linkUrl).toBe(`#/exam/${examId}`);
  });

  test("ungraded (SUBMITTED) essay attempts do not count as taken", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    // essay exam → submit leaves the attempt SUBMITTED (teacher must grade)
    const created = await api<{ id: string }>(baseUrl(), "/api/v1/exams", {
      method: "POST",
      cookie: teacher.cookie,
      json: {
        title: `آزمون انشایی داشبورد ${Date.now()}`,
        grade: "دهم",
        subject: "ریاضی",
        published: true,
        questions: [{ type: "ESSAY", text: "توضیح بده.", points: 10 }],
      },
    });
    expect(created.status).toBe(201);
    const started = await api<{ attemptId: string }>(
      baseUrl(),
      `/api/v1/exams/${created.data.id}/attempts/start`,
      { method: "POST", cookie: student.cookie }
    );
    expect(started.status).toBe(201);
    const submitted = await api(
      baseUrl(),
      `/api/v1/exams/${created.data.id}/attempts/${started.data.attemptId}/submit`,
      { method: "POST", cookie: student.cookie, json: { answers: {} } }
    );
    expect(submitted.status).toBe(201);

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.exams.taken).toBe(0);
    expect(r.data.summary.exams.averageScorePct).toBeNull();
  });

  test("enrolling in a course → enrolled=1 with a course activity; watched lessons lift progress", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const course = await createCourse(baseUrl(), teacher.cookie, { lessonCount: 4, price: 0 });
    await ensureWalletBalance(baseUrl(), student.cookie, 100000);

    const buy = await api(baseUrl(), `/api/v1/courses/${course.id}/purchase`, {
      method: "POST",
      cookie: student.cookie,
      json: {},
    });
    expect(buy.status).toBe(201);

    // watch lesson 1 of 4 → 25%
    const watched = await api(baseUrl(), `/api/v1/lessons/${course.lessonIds[0]}/watched`, {
      method: "POST",
      cookie: student.cookie,
      json: { watched: true },
    });
    expect(watched.status).toBe(200);

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.courses.enrolled).toBe(1);
    expect(r.data.summary.courses.averageProgressPct).toBe(25);
    const courseActivity = r.data.recent.find((a) => a.type === "course");
    expect(courseActivity).toBeTruthy();
    expect(courseActivity!.id).toBe(course.id);
    expect(courseActivity!.progressPct).toBe(25);
    expect(courseActivity!.linkUrl).toBe(`#/course/${course.id}`);
  });

  test("BOOKED upcoming session → nextSession with teacher name + role student; upcoming count", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [
      { startAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), price: 50000 },
    ]);
    await ensureWalletBalance(baseUrl(), student.cookie, 100000);
    const booked = await api<{ id: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST",
      cookie: student.cookie,
      json: { slotId, topic: "جلسهٔ داشبورد" },
    });
    expect(booked.status).toBe(201);

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.sessions.upcoming).toBe(1);
    expect(r.data.summary.sessions.attended).toBe(0);
    expect(r.data.upcoming.nextSession).not.toBeNull();
    expect(r.data.upcoming.nextSession!.id).toBe(booked.data.id);
    expect(r.data.upcoming.nextSession!.role).toBe("student");
    expect(r.data.upcoming.nextSession!.teacherName).toBeTruthy();
    expect(r.data.upcoming.nextSession!.studentName).toBe(student.user.fullName);
  });

  test("COMPLETED session → attended=1 and a session activity", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    // slots must open ≥1h in the future and cost ≥20,000; complete() has no startAt check
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [
      { startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), price: 20000 },
    ]);
    await ensureWalletBalance(baseUrl(), student.cookie, 100000);
    const booked = await api<{ id: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST",
      cookie: student.cookie,
      json: { slotId, topic: "جلسهٔ تکمیل‌شدنی" },
    });
    expect(booked.status).toBe(201);

    const completed = await api(baseUrl(), `/api/v1/sessions/${booked.data.id}/complete`, {
      method: "POST",
      cookie: teacher.cookie,
      json: {},
    });
    expect(completed.status).toBe(200);

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.sessions.attended).toBe(1);
    const sessionActivity = r.data.recent.find((a) => a.type === "session");
    expect(sessionActivity).toBeTruthy();
    expect(sessionActivity!.id).toBe(booked.data.id);
    expect(sessionActivity!.linkUrl).toBe(`#/session/${booked.data.id}`);
  });

  test("merged recent activity is sorted newest-first", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });

    // older activity first: lesson start
    const lessonId = await createPublishedLesson(teacher.cookie);
    const adv = await api(baseUrl(), `/api/v1/interactive-lessons/${lessonId}/advance`, {
      method: "POST",
      cookie: student.cookie,
      json: { stepIndex: 0, answer: null },
    });
    expect(adv.status).toBe(200);

    // newer activity second: exam submission
    const { examId, questions } = await publishMcExam(teacher.cookie);
    await takeExam(student.cookie, examId, {
      [questions[0].id]: questions[0].correctOptionId,
      [questions[1].id]: questions[1].correctOptionId,
      [questions[2].id]: questions[2].correctOptionId,
    });

    const r = await getDashboard(student.cookie);
    expect(r.data.recent.length).toBeGreaterThanOrEqual(2);
    const times = r.data.recent.map((a) => new Date(a.updatedAt).getTime());
    for (let i = 0; i < times.length - 1; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i + 1]);
    }
    // the exam (submitted last) must rank above the lesson
    expect(r.data.recent[0].type).toBe("exam");
    expect(r.data.recent[0].id).toBe(examId);
  });

  test("more than 20 activities → recent capped at 20", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    await ensureWalletBalance(baseUrl(), student.cookie, 3_000_000);

    // 22 enrollments → 22 course activities
    for (let i = 0; i < 22; i++) {
      const course = await createCourse(baseUrl(), teacher.cookie, { lessonCount: 1, price: 0 });
      const buy = await api(baseUrl(), `/api/v1/courses/${course.id}/purchase`, {
        method: "POST",
        cookie: student.cookie,
        json: {},
      });
      expect(buy.status).toBe(201);
    }

    const r = await getDashboard(student.cookie);
    expect(r.data.summary.courses.enrolled).toBe(22);
    expect(r.data.recent.length).toBe(20);
    const times = r.data.recent.map((a) => new Date(a.updatedAt).getTime());
    for (let i = 0; i < times.length - 1; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i + 1]);
    }
  });

  test("activities are per-user (another student's progress is invisible)", async () => {
    const teacher = await registerUser(baseUrl());
    const a = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const b = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const lessonId = await createPublishedLesson(teacher.cookie);
    const adv = await api(baseUrl(), `/api/v1/interactive-lessons/${lessonId}/advance`, {
      method: "POST",
      cookie: a.cookie,
      json: { stepIndex: 0, answer: null },
    });
    expect(adv.status).toBe(200);

    const rA = await getDashboard(a.cookie);
    expect(rA.data.summary.interactiveLessons.started).toBe(1);
    const rB = await getDashboard(b.cookie);
    expect(rB.data.summary.interactiveLessons.started).toBe(0);
    expect(rB.data.recent).toEqual([]);
  });
});
