// /api/v1/exams/[id]/attempts — GET (owner list with status fields) (P12/P14)
// P14: the old single-shot POST moved to /attempts/start + /attempts/[id]/submit.
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";

// ---------- GET: owner sees all attempts on their exam ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      questions: { select: { id: true, type: true } },
    },
  });
  if (!exam) return fail("آزمون پیدا نشد", 404);
  if (exam.teacherId !== user.id) return fail("فقط نویسندهٔ آزمون می‌تواند نتایج را ببیند", 403);

  const essayCount = exam.questions.filter((q) => q.type === "ESSAY").length;

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
      status: a.status as "IN_PROGRESS" | "SUBMITTED" | "GRADED",
      autoScore: a.autoScore,
      manualScore: a.manualScore,
      totalScore: a.autoScore + (a.manualScore ?? 0),
      maxScore: a.maxScore,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      // P14 — essays awaiting the teacher's pen (SUBMITTED only)
      pendingEssayCount: a.status === "SUBMITTED" ? essayCount : 0,
    })),
    total,
  });
}
