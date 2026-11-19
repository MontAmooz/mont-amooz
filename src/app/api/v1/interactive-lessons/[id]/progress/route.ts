// GET /api/v1/interactive-lessons/[id]/progress — the current user's progress
// on this lesson (player resume source) or { progress: null } (P15).
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const lesson = await db.interactiveLesson.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!lesson) return fail("درس پیدا نشد", 404);

  const progress = await db.interactiveLessonProgress.findUnique({
    where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
    select: {
      currentStep: true,
      completed: true,
      responses: true,
      startedAt: true,
      completedAt: true,
    },
  });

  let parsed: Record<string, { answer: string; correct: boolean; attempts: number }> = {};
  if (progress) {
    try {
      const raw: unknown = JSON.parse(progress.responses || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        parsed = raw as Record<string, { answer: string; correct: boolean; attempts: number }>;
      }
    } catch {
      parsed = {};
    }
  }

  return ok({
    progress: progress
      ? {
          currentStep: progress.currentStep,
          completed: progress.completed,
          responses: parsed,
          startedAt: progress.startedAt.toISOString(),
          completedAt: progress.completedAt?.toISOString() ?? null,
        }
      : null,
  });
}
