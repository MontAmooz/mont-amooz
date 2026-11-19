// /api/v1/interactive-lessons — GET (list, published by default; mine=true for
// the owner) + POST (teacher creates with TEXT/MC/NUMERIC steps) (P15).
import { db } from "@/lib/db";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { normalizePersian } from "@/lib/format";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { parseInteractiveSteps } from "@/lib/server/serializers";
import type { LessonSummary } from "@/lib/types";

// ---------- GET: list ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const grade = url.searchParams.get("grade") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  const mine = url.searchParams.get("mine") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    48,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12)
  );

  const viewer = await requireUser(); // optional — published lessons are public
  if (mine && !viewer) return unauthorized();

  // dataset is small: fetch candidates + JS filter (same pattern as exams)
  const rows = await db.interactiveLesson.findMany({
    where: {
      ...(mine && viewer ? { teacherId: viewer.id } : { published: true }),
      ...(grade ? { grade } : {}),
      ...(subject ? { subject } : {}),
    },
    include: {
      teacher: { select: { id: true, fullName: true, title: true } },
      _count: { select: { steps: true, progress: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const nq = normalizePersian(query);
  const filtered = nq
    ? rows.filter((l) =>
        [l.title, l.description ?? ""].some((f) => normalizePersian(f).includes(nq))
      )
    : rows;

  const pageItems = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  // my progress for the page's lessons (single query, matched back here)
  const progressRows =
    viewer && pageItems.length > 0
      ? await db.interactiveLessonProgress.findMany({
          where: { userId: viewer.id, lessonId: { in: pageItems.map((l) => l.id) } },
          select: { lessonId: true, currentStep: true, completed: true, startedAt: true, completedAt: true },
        })
      : [];
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

  const items: LessonSummary[] = pageItems.map((l) => {
    const p = progressByLesson.get(l.id);
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      grade: l.grade,
      subject: l.subject,
      published: l.published,
      estimatedMinutes: l.estimatedMinutes,
      stepCount: l._count.steps,
      teacher: { id: l.teacher.id, fullName: l.teacher.fullName, title: l.teacher.title },
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      participantCount: l._count.progress,
      myProgress: p
        ? {
            currentStep: p.currentStep,
            completed: p.completed,
            startedAt: p.startedAt.toISOString(),
            completedAt: p.completedAt?.toISOString() ?? null,
          }
        : null,
    };
  });

  const total = filtered.length;
  return ok({ items, total, page, pageSize });
}

// ---------- POST: create (teacher only) ----------
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (user.role !== "معلم") return fail("فقط معلم می‌تواند درس تعاملی بسازد", 403);

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const title = asString(body.title)?.trim() ?? "";
  if (title.length < 3 || title.length > 120) {
    return fail("عنوان درس باید بین ۳ تا ۱۲۰ نویسه باشد");
  }
  const description = asString(body.description)?.trim() ?? "";
  if (description.length > 2000) return fail("توضیحات درس حداکثر ۲۰۰۰ نویسه است");
  const grade = oneOf(body.grade, GRADES);
  if (!grade) return fail("پایه نامعتبر است");
  const subject = oneOf(body.subject, SUBJECTS);
  if (!subject) return fail("درس نامعتبر است");
  const published = body.published === true;
  let estimatedMinutes: number | null = null;
  if (body.estimatedMinutes !== undefined && body.estimatedMinutes !== null) {
    if (
      typeof body.estimatedMinutes !== "number" ||
      !Number.isInteger(body.estimatedMinutes) ||
      body.estimatedMinutes < 1 ||
      body.estimatedMinutes > 600
    ) {
      return fail("زمان تقریبی باید بین ۱ تا ۶۰۰ دقیقه باشد");
    }
    estimatedMinutes = body.estimatedMinutes;
  }

  const steps = parseInteractiveSteps(body.steps);
  if (typeof steps === "string") return fail(steps);

  const lesson = await db.interactiveLesson.create({
    data: {
      teacherId: user.id,
      title,
      description: description || null,
      grade,
      subject,
      published,
      estimatedMinutes,
      steps: {
        create: steps.map((s, i) => ({
          order: i, // 0-indexed — matches progress.currentStep
          type: s.type,
          content: s.content,
          options: s.options ? JSON.stringify(s.options) : null,
          correctOptionId: s.correctOptionId,
          correctNumeric: s.correctNumeric,
          tolerance: s.tolerance,
          explanation: s.explanation,
        })),
      },
    },
    select: { id: true },
  });
  return ok({ id: lesson.id }, 201);
}
