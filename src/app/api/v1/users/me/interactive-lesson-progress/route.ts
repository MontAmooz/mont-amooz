// GET /api/v1/users/me/interactive-lesson-progress — the current user's
// progress across all interactive lessons, newest activity first (P15).
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";
import type { MyLessonProgressSummary } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const rows = await db.interactiveLessonProgress.findMany({
    where: { userId: user.id },
    include: {
      lesson: { select: { id: true, title: true, grade: true, subject: true, _count: { select: { steps: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items: MyLessonProgressSummary[] = rows.map((p) => ({
    lesson: {
      id: p.lesson.id,
      title: p.lesson.title,
      grade: p.lesson.grade,
      subject: p.lesson.subject,
    },
    currentStep: p.currentStep,
    stepCount: p.lesson._count.steps,
    completed: p.completed,
    startedAt: p.startedAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  }));
  return ok({ items });
}
