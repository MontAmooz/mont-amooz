// /api/v1/exams/[id]/attempts — POST (student submits + server grades) + GET (owner list) (P12)
import { db } from "@/lib/db";
import { gradeExam } from "@/lib/exam-grading";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

// ---------- POST: take + submit in one call ----------
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      teacherId: true,
      published: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, correctOptionId: true, points: true },
      },
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

  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null || Array.isArray(body.answers)) {
    return fail("داده‌های ارسالی نامعتبر است");
  }
  const answers: Record<string, string> = {};
  for (const [qId, optionId] of Object.entries(body.answers as Record<string, unknown>)) {
    if (typeof optionId !== "string") return fail("پاسخ‌های ارسالی نامعتبر است");
    answers[qId] = optionId;
  }

  // every submitted answer must reference a real question AND option
  const questionMap = new Map(exam.questions.map((q) => [q.id, q]));
  const validOptions = new Map<string, Set<string>>();
  const optionRows = await db.examQuestion.findMany({
    where: { examId: exam.id },
    select: { id: true, options: true },
  });
  for (const row of optionRows) validOptions.set(row.id, new Set(JSON.parse(row.options).map((o: { id: string }) => o.id)));
  for (const [qId, optionId] of Object.entries(answers)) {
    if (!questionMap.has(qId)) return fail("پاسخ به سؤال ناموجود", 400);
    if (!validOptions.get(qId)?.has(optionId)) return fail("پاسخ به گزینهٔ ناموجود", 400);
  }

  const graded = gradeExam({
    questions: exam.questions.map((q) => ({
      id: q.id,
      correctOptionId: q.correctOptionId,
      points: q.points,
    })),
    answers,
  });

  const attempt = await db.examAttempt.create({
    data: {
      examId: exam.id,
      studentId: user.id,
      answers: JSON.stringify(answers),
      score: graded.score,
      maxScore: graded.maxScore,
    },
    select: { id: true },
  });

  // P11/P12 — notify the teacher (after the attempt commits)
  await notify({
    userId: exam.teacherId,
    actorId: user.id,
    type: "EXAM_COMPLETED",
    title: "پاسخ جدید به آزمون",
    body: `«${user.fullName}» در آزمون «${exam.title}» با امتیاز ${graded.score} از ${graded.maxScore} شرکت کرد`,
    linkUrl: `#/exam/${exam.id}`,
    relatedId: exam.id,
    relatedType: "exam",
  });

  return ok({ attemptId: attempt.id, score: graded.score, maxScore: graded.maxScore }, 201);
}

// ---------- GET: owner sees all attempts on their exam ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: { id: true, teacherId: true },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);
  if (exam.teacherId !== user.id) return fail("فقط نویسندهٔ آزمون می‌تواند نتایج را ببیند", 403);

  const [rows, total] = await Promise.all([
    db.examAttempt.findMany({
      where: { examId: id },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    db.examAttempt.count({ where: { examId: id } }),
  ]);

  return ok({
    items: rows.map((a) => ({
      id: a.id,
      student: { id: a.student.id, fullName: a.student.fullName },
      score: a.score,
      maxScore: a.maxScore,
      submittedAt: a.submittedAt.toISOString(),
    })),
    total,
  });
}
