// POST /api/v1/exams/[id]/attempts/[attemptId]/submit — student submits answers (P14)
// Server grades MC immediately; ESSAY questions await the teacher (status SUBMITTED).
// Server-side timer: if durationMinutes elapsed, accept anyway but flag timeLimitReached.
import { db } from "@/lib/db";
import { gradeExam } from "@/lib/exam-grading";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

const GRACE_MS = 1000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, attemptId } = await params;
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          teacherId: true,
          published: true,
          durationMinutes: true,
          questions: {
            orderBy: { order: "asc" },
            select: { id: true, type: true, correctOptionId: true, points: true, options: true },
          },
        },
      },
    },
  });
  if (!attempt || attempt.examId !== id) return fail("پاسخ آزمون پیدا نشد", 404);
  if (attempt.studentId !== user.id) return fail("دسترسی ندارید", 403);
  if (attempt.status !== "IN_PROGRESS") return fail("این آزمون قبلاً ارسال شده است");
  if (!attempt.startedAt) return fail("این آزمون شروع نشده است", 400);

  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null || Array.isArray(body.answers)) {
    return fail("داده‌های ارسالی نامعتبر است");
  }
  const answers: Record<string, string> = {};
  for (const [qId, answer] of Object.entries(body.answers as Record<string, unknown>)) {
    if (typeof answer !== "string") return fail("پاسخ‌های ارسالی نامعتبر است");
    answers[qId] = answer;
  }

  // timer check — server clock is the only truth
  const exam = attempt.exam;
  let timeLimitReached = false;
  if (exam.durationMinutes !== null) {
    const elapsed = Date.now() - attempt.startedAt.getTime();
    if (elapsed > exam.durationMinutes * 60_000 + GRACE_MS) {
      timeLimitReached = true;
    }
  }

  // validate every answer references a real question; MC answers must be a
  // real option of that question; ESSAY answers are free text (2..5000 chars)
  const optionSets = new Map<string, Set<string>>();
  for (const q of exam.questions) {
    if (q.type === "MC") {
      const opts = JSON.parse(q.options ?? "[]") as Array<{ id: string }>;
      optionSets.set(q.id, new Set(opts.map((o) => o.id)));
    }
  }
  for (const [qId, answer] of Object.entries(answers)) {
    const q = exam.questions.find((x) => x.id === qId);
    if (!q) return fail("پاسخ به سؤال ناموجود", 400);
    if (q.type === "MC") {
      if (!optionSets.get(qId)?.has(answer)) return fail("پاسخ به گزینهٔ ناموجود", 400);
    } else if (answer.trim().length > 5000) {
      return fail("متن پاسخ تشریحی حداکثر ۵۰۰۰ نویسه است");
    }
  }

  const graded = gradeExam({
    questions: exam.questions.map((q) => ({
      id: q.id,
      type: q.type as "MC" | "ESSAY",
      correctOptionId: q.correctOptionId,
      points: q.points,
    })),
    answers,
  });

  const updated = await db.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: graded.hasEssay ? "SUBMITTED" : "GRADED",
      answers: JSON.stringify(answers),
      autoScore: graded.autoScore,
      score: graded.autoScore, // legacy field: updated again when teacher grades
      manualScore: graded.hasEssay ? null : 0,
      submittedAt: new Date(),
      timeLimitReached,
    },
    select: { id: true },
  });
  void updated;

  // P11/P12/P14 — notify the teacher (after the attempt commits)
  if (graded.hasEssay) {
    const essayCount = exam.questions.filter((q) => q.type === "ESSAY").length;
    await notify({
      userId: exam.teacherId,
      actorId: user.id,
      type: "EXAM_COMPLETED",
      title: "پاسخ جدید به آزمون",
      body: `«${user.fullName}» در آزمون «${exam.title}» شرکت کرد؛ ${essayCount} سؤال تشریحی نیازمند تصحیح است`,
      linkUrl: `#/exam/${exam.id}`,
      relatedId: exam.id,
      relatedType: "exam",
    });
  } else {
    await notify({
      userId: exam.teacherId,
      actorId: user.id,
      type: "EXAM_COMPLETED",
      title: "پاسخ جدید به آزمون",
      body: `«${user.fullName}» در آزمون «${exam.title}» با امتیاز ${graded.autoScore} از ${graded.maxScore} شرکت کرد`,
      linkUrl: `#/exam/${exam.id}`,
      relatedId: exam.id,
      relatedType: "exam",
    });
  }

  return ok(
    {
      attemptId,
      status: graded.hasEssay ? "SUBMITTED" : "GRADED",
      autoScore: graded.autoScore,
      maxScore: graded.maxScore,
      hasEssay: graded.hasEssay,
      timeLimitReached,
    },
    201
  );
}
