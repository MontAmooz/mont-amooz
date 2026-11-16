// GET /api/v1/users/me/exam-attempts — the current student's exam history (P12)
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";
import type { MyExamAttemptSummary } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const rows = await db.examAttempt.findMany({
    where: { studentId: user.id },
    include: { exam: { select: { id: true, title: true, grade: true, subject: true } } },
    orderBy: { submittedAt: "desc" },
  });

  const items: MyExamAttemptSummary[] = rows.map((a) => ({
    id: a.id,
    exam: {
      id: a.exam.id,
      title: a.exam.title,
      grade: a.exam.grade,
      subject: a.exam.subject,
    },
    score: a.score,
    maxScore: a.maxScore,
    submittedAt: a.submittedAt.toISOString(),
  }));
  return ok({ items });
}
