// POST /api/v1/exams/[id]/attempts/start — student starts an attempt (P14)
// Creates the IN_PROGRESS attempt and starts the server-side timer clock.
// The single-attempt unique constraint guarantees one attempt per student.
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      published: true,
      durationMinutes: true,
      questions: { select: { points: true } },
    },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);
  if (exam.teacherId === user.id) return fail("نمی‌توانید در آزمون خودتان شرکت کنید", 403);
  if (!exam.published) return fail("آزمون منتشر نشده است");

  const existing = await db.examAttempt.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: user.id } },
    select: { id: true },
  });
  if (existing) return fail("شما قبلاً در این آزمون شرکت کرده‌اید", 409);

  const maxScore = exam.questions.reduce((s, q) => s + q.points, 0);
  const startedAt = new Date();

  const attempt = await db.examAttempt.create({
    data: {
      examId: exam.id,
      studentId: user.id,
      status: "IN_PROGRESS",
      startedAt,
      answers: null,
      autoScore: 0,
      score: 0, // legacy field — computed at submit/grading
      maxScore,
    },
    select: { id: true, startedAt: true },
  });

  return ok(
    {
      attemptId: attempt.id,
      startedAt: attempt.startedAt!.toISOString(),
      durationMinutes: exam.durationMinutes, // null = no timer
      serverNow: Date.now(), // client clock sync reference
    },
    201
  );
}
