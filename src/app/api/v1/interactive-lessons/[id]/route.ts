// /api/v1/interactive-lessons/[id] — GET (viewer-shaped detail) + PATCH
// (owner edit; steps lock once any progress exists) + DELETE (P15).
import { db } from "@/lib/db";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";
import {
  parseInteractiveSteps,
  toInteractiveStepStudent,
  toInteractiveStepTeacher,
} from "@/lib/server/serializers";
import type { LessonDetail, LessonSummary } from "@/lib/types";

const STEP_SELECT = {
  id: true,
  order: true,
  type: true,
  content: true,
  options: true,
  correctOptionId: true,
  correctNumeric: true,
  tolerance: true,
  explanation: true,
} as const;

function toLessonSummary(
  lesson: {
    id: string;
    title: string;
    description: string | null;
    grade: string;
    subject: string;
    published: boolean;
    estimatedMinutes: number | null;
    createdAt: Date;
    updatedAt: Date;
    teacher: { id: string; fullName: string; title: string | null };
    _count: { steps: number };
  },
  myProgress: LessonSummary["myProgress"]
): LessonSummary {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    grade: lesson.grade,
    subject: lesson.subject,
    published: lesson.published,
    estimatedMinutes: lesson.estimatedMinutes,
    stepCount: lesson._count.steps,
    teacher: { id: lesson.teacher.id, fullName: lesson.teacher.fullName, title: lesson.teacher.title },
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    myProgress,
  };
}

/** Parse a progress row's responses JSON (defensive against malformed data). */
function parseResponses(raw: string): Record<string, { answer: string; correct: boolean; attempts: number }> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, { answer: string; correct: boolean; attempts: number }> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      if (typeof r.answer === "string" && typeof r.correct === "boolean" && typeof r.attempts === "number") {
        out[k] = { answer: r.answer, correct: r.correct, attempts: r.attempts };
      }
    }
    return out;
  } catch {
    return {};
  }
}

// ---------- GET: detail (shape depends on viewer) ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(); // optional — published lessons are public

  const lesson = await db.interactiveLesson.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, fullName: true, title: true } },
      steps: { orderBy: { order: "asc" }, select: STEP_SELECT },
      _count: { select: { steps: true, progress: true } },
    },
  });
  if (!lesson) return fail("درس پیدا نشد", 404);

  const isMine = !!viewer && viewer.id === lesson.teacherId;
  // drafts are visible to the owner only
  if (!lesson.published && !isMine) return fail("درس پیدا نشد", 404);

  // the viewer's own progress (students resume from it; teachers may test-drive)
  const progressRow = viewer
    ? await db.interactiveLessonProgress.findUnique({
        where: { lessonId_userId: { lessonId: lesson.id, userId: viewer.id } },
        select: { currentStep: true, completed: true, responses: true, startedAt: true, completedAt: true },
      })
    : null;
  const myProgress = progressRow
    ? {
        currentStep: progressRow.currentStep,
        completed: progressRow.completed,
        startedAt: progressRow.startedAt.toISOString(),
        completedAt: progressRow.completedAt?.toISOString() ?? null,
      }
    : null;

  const base = toLessonSummary(lesson, myProgress);

  const detail: LessonDetail =
    isMine && viewer
      ? {
          ...base,
          steps: lesson.steps.map(toInteractiveStepTeacher),
          isMine: true,
          hasProgress: lesson._count.progress > 0,
        }
      : {
          ...base,
          steps: lesson.steps.map(toInteractiveStepStudent),
          isMine: false,
          progress: progressRow
            ? {
                currentStep: progressRow.currentStep,
                completed: progressRow.completed,
                responses: parseResponses(progressRow.responses),
              }
            : null,
        };

  return ok(detail);
}

// ---------- PATCH: owner edit (steps lock after first participant) ----------
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const lesson = await db.interactiveLesson.findUnique({
    where: { id },
    select: { id: true, teacherId: true, _count: { select: { progress: true } } },
  });
  if (!lesson) return fail("درس پیدا نشد", 404);
  if (lesson.teacherId !== user.id) return fail("فقط نویسندهٔ درس می‌تواند ویرایش کند", 403);

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const data: {
    title?: string;
    description?: string | null;
    grade?: string;
    subject?: string;
    published?: boolean;
    estimatedMinutes?: number | null;
  } = {};

  if (body.title !== undefined) {
    const title = asString(body.title)?.trim() ?? "";
    if (title.length < 3 || title.length > 120) {
      return fail("عنوان درس باید بین ۳ تا ۱۲۰ نویسه باشد");
    }
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = asString(body.description)?.trim() ?? "";
    if (description.length > 2000) return fail("توضیحات درس حداکثر ۲۰۰۰ نویسه است");
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
  if (body.estimatedMinutes !== undefined) {
    if (body.estimatedMinutes === null) {
      data.estimatedMinutes = null;
    } else if (
      typeof body.estimatedMinutes === "number" &&
      Number.isInteger(body.estimatedMinutes) &&
      body.estimatedMinutes >= 1 &&
      body.estimatedMinutes <= 600
    ) {
      data.estimatedMinutes = body.estimatedMinutes;
    } else {
      return fail("زمان تقریبی باید بین ۱ تا ۶۰۰ دقیقه باشد");
    }
  }

  if (body.steps !== undefined) {
    // lock rule: once ANY user has progress, steps are frozen (responses reference step ids)
    if (lesson._count.progress > 0) {
      return fail("نمی‌توانید گام‌ها را بعد از اولین شرکت‌کننده تغییر دهید");
    }
    const steps = parseInteractiveSteps(body.steps);
    if (typeof steps === "string") return fail(steps);

    // simplest correct MVP edit: replace all steps (delete + recreate)
    await db.$transaction([
      db.interactiveStep.deleteMany({ where: { lessonId: id } }),
      db.interactiveStep.createMany({
        data: steps.map((s, i) => ({
          lessonId: id,
          order: i, // 0-indexed — matches progress.currentStep
          type: s.type,
          content: s.content,
          options: s.options ? JSON.stringify(s.options) : null,
          correctOptionId: s.correctOptionId,
          correctNumeric: s.correctNumeric,
          tolerance: s.tolerance,
          explanation: s.explanation,
        })),
      }),
    ]);
  }

  await db.interactiveLesson.update({ where: { id }, data });
  return ok({ ok: true });
}

// ---------- DELETE: owner only ----------
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const lesson = await db.interactiveLesson.findUnique({
    where: { id },
    select: { id: true, teacherId: true },
  });
  if (!lesson) return fail("درس پیدا نشد", 404);
  if (lesson.teacherId !== user.id) return fail("فقط نویسندهٔ درس می‌تواند حذف کند", 403);

  await db.interactiveLesson.delete({ where: { id } }); // cascades steps + progress
  return new Response(null, { status: 204 });
}
