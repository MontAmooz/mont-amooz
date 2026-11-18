// /api/v1/exams/[id] — GET (viewer-shaped detail) + PATCH (owner edit) + DELETE (P12)
import { db } from "@/lib/db";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";
import {
  parseExamQuestions,
  toExamQuestionStudent,
  toExamQuestionTeacher,
  toExamSummary,
} from "@/lib/server/serializers";
import type { ExamDetail } from "@/lib/types";

const QUESTION_SELECT = {
  id: true,
  order: true,
  text: true,
  type: true,
  options: true,
  correctOptionId: true,
  points: true,
} as const;

// ---------- GET: detail (shape depends on viewer) ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(); // optional — published exams are public

  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, fullName: true, title: true } },
      questions: { orderBy: { order: "asc" }, select: QUESTION_SELECT },
      _count: { select: { questions: true, attempts: true } },
      attempts: { select: { score: true, maxScore: true } },
    },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);

  const isMine = !!viewer && viewer.id === exam.teacherId;
  // drafts are visible to the owner only
  if (!exam.published && !isMine) return fail("آزمون پیدا نشد", 404);

  let myAttempt: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
    autoScore: number;
    manualScore: number | null;
    score: number;
    maxScore: number;
    submittedAt: string | null;
  } | null = null;
  if (viewer && !isMine) {
    const attempt = await db.examAttempt.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: viewer.id } },
      select: {
        id: true, status: true, autoScore: true, manualScore: true,
        score: true, maxScore: true, submittedAt: true,
      },
    });
    myAttempt = attempt
      ? {
          id: attempt.id,
          status: attempt.status as "IN_PROGRESS" | "SUBMITTED" | "GRADED",
          autoScore: attempt.autoScore,
          manualScore: attempt.manualScore,
          score: attempt.score,
          maxScore: attempt.maxScore,
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
        }
      : null;
  }

  const detail =
    isMine && viewer
      ? ({
          ...toExamSummary(exam),
          questions: exam.questions.map(toExamQuestionTeacher),
          isMine: true,
        } as ExamDetail)
      : ({
          ...toExamSummary(exam),
          questions: exam.questions.map(toExamQuestionStudent),
          isMine: false,
          myAttempt,
        } as ExamDetail);

  return ok(detail);
}

// ---------- PATCH: owner edit (questions lock after first attempt) ----------
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      durationMinutes: true,
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);
  if (exam.teacherId !== user.id) return fail("فقط نویسندهٔ آزمون می‌تواند ویرایش کند", 403);

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const data: {
    title?: string;
    description?: string | null;
    grade?: string;
    subject?: string;
    published?: boolean;
    durationMinutes?: number | null;
  } = {};

  if (body.title !== undefined) {
    const title = asString(body.title)?.trim() ?? "";
    if (title.length < 3 || title.length > 120) {
      return fail("عنوان آزمون باید بین ۳ تا ۱۲۰ نویسه باشد");
    }
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = asString(body.description)?.trim() ?? "";
    if (description.length > 2000) return fail("توضیحات آزمون حداکثر ۲۰۰۰ نویسه است");
    data.description = description || null;
  }
  if (body.grade !== undefined) {
    const grade = oneOf(body.grade, GRADES);
    if (!grade) return fail("پایه نامعتبر است");
    data.grade = grade;
  }
  if (body.subject !== undefined) {
    const subject = oneOf(body.subject, SUBJECTS);
    if (!subject) return fail("درس نامعتبر است");
    data.subject = subject;
  }
  if (body.published !== undefined) {
    if (typeof body.published !== "boolean") return fail("وضعیت انتشار نامعتبر است");
    data.published = body.published;
  }
  if (body.durationMinutes !== undefined) {
    // P14 — timer length locks once any attempt exists (startedAt is set)
    const hasAttempts = exam._count.attempts > 0;
    if (hasAttempts && body.durationMinutes !== exam.durationMinutes) {
      return fail("نمی‌توانید زمان را بعد از اولین شرکت‌کننده تغییر دهید");
    }
    if (body.durationMinutes === null) {
      data.durationMinutes = null;
    } else if (
      typeof body.durationMinutes === "number" &&
      Number.isInteger(body.durationMinutes) &&
      body.durationMinutes >= 1 &&
      body.durationMinutes <= 240
    ) {
      data.durationMinutes = body.durationMinutes;
    } else {
      return fail("مدت آزمون باید بین ۱ تا ۲۴۰ دقیقه باشد");
    }
  }

  const hasAttempts = exam._count.attempts > 0;
  if (body.questions !== undefined) {
    if (hasAttempts) {
      return fail("نمی‌توانید سؤالات را بعد از دریافت پاسخ تغییر دهید");
    }
    const questions = parseExamQuestions(body.questions);
    if (typeof questions === "string") return fail(questions);

    // simplest correct MVP edit: replace all questions (delete + recreate)
    await db.$transaction([
      db.examQuestion.deleteMany({ where: { examId: id } }),
      db.examQuestion.createMany({
        data: questions.map((q, i) => ({
          examId: id,
          order: i + 1,
          text: q.text,
          options: JSON.stringify(q.options),
          correctOptionId: q.correctOptionId,
          points: q.points,
        })),
      }),
    ]);
  }

  await db.exam.update({ where: { id }, data });
  return ok({ ok: true });
}

// ---------- DELETE: owner only ----------
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: { id: true, teacherId: true },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);
  if (exam.teacherId !== user.id) return fail("فقط نویسندهٔ آزمون می‌تواند حذف کند", 403);

  await db.exam.delete({ where: { id } }); // cascades questions + attempts
  return new Response(null, { status: 204 });
}
