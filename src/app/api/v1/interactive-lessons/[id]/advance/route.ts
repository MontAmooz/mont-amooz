// POST /api/v1/interactive-lessons/[id]/advance — the core player action (P15).
// Sequential only: stepIndex must equal the progress cursor, correctness is
// graded server-side (validateStepAnswer), wrong answers keep the cursor and
// return the explanation, correct answers advance (final one completes).
// Progress responses record MC/NUMERIC attempts only — TEXT steps are
// read-only and must not inflate firstTryCorrect stats.
import { db } from "@/lib/db";
import { normalizePersian } from "@/lib/format";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { validateStepAnswer, computeFirstTryCorrect } from "@/lib/lesson-grading";
import { notify } from "@/lib/server/notify";
import type { AdvanceResult } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  if (typeof body.stepIndex !== "number" || !Number.isInteger(body.stepIndex) || body.stepIndex < 0) {
    return fail("گام نامعتبر است");
  }
  const answer =
    body.answer === null || body.answer === undefined
      ? null
      : typeof body.answer === "string"
        ? body.answer
        : null;

  const lesson = await db.interactiveLesson.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      title: true,
      published: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          type: true,
          correctOptionId: true,
          correctNumeric: true,
          tolerance: true,
          explanation: true,
        },
      },
    },
  });
  if (!lesson) return fail("درس پیدا نشد", 404);
  const isOwner = lesson.teacherId === user.id;
  if (!lesson.published && !isOwner) return fail("درس پیدا نشد", 404);

  // load-or-create this user's progress
  let progress = await db.interactiveLessonProgress.findUnique({
    where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
  });
  if (!progress) {
    progress = await db.interactiveLessonProgress.create({
      data: { lessonId: lesson.id, userId: user.id },
    });
  }

  if (progress.completed) return fail("درس تکمیل شده است");

  const stepIndex = body.stepIndex;
  if (stepIndex !== progress.currentStep || stepIndex >= lesson.steps.length) {
    return fail("گام نامعتبر است");
  }

  const step = lesson.steps[stepIndex];

  // grade server-side; NUMERIC answers may carry Persian digits / thousand
  // separators — normalize before Number() (P15 escape-hatch #2)
  let gradedAnswer = answer;
  if (step.type === "NUMERIC" && answer !== null) {
    gradedAnswer = normalizePersian(answer).replace(/[,٬\s]/g, "");
  }
  const { correct } = validateStepAnswer(
    {
      type: step.type as "TEXT" | "MC" | "NUMERIC",
      correctOptionId: step.correctOptionId,
      correctNumeric: step.correctNumeric,
      tolerance: step.tolerance,
    },
    gradedAnswer
  );

  // record the attempt (graded steps only)
  let completed = false;
  const now = new Date();
  if (step.type !== "TEXT") {
    const responses = JSON.parse(progress.responses || "{}") as Record<
      string,
      { answer: string; correct: boolean; attempts: number }
    >;
    const prev = responses[step.id];
    responses[step.id] = {
      answer: gradedAnswer ?? "",
      correct: correct || (prev?.correct ?? false),
      attempts: (prev?.attempts ?? 0) + 1,
    };
    if (correct) {
      const nextStep = progress.currentStep + 1;
      completed = nextStep >= lesson.steps.length;
      progress = await db.interactiveLessonProgress.update({
        where: { id: progress.id },
        data: {
          responses: JSON.stringify(responses),
          currentStep: nextStep,
          completed,
          completedAt: completed ? now : null,
        },
      });
    } else {
      progress = await db.interactiveLessonProgress.update({
        where: { id: progress.id },
        data: { responses: JSON.stringify(responses) },
      });
    }
  } else if (correct) {
    // TEXT step — no response recorded; just move the cursor
    const nextStep = progress.currentStep + 1;
    completed = nextStep >= lesson.steps.length;
    progress = await db.interactiveLessonProgress.update({
      where: { id: progress.id },
      data: {
        currentStep: nextStep,
        completed,
        completedAt: completed ? now : null,
      },
    });
  }

  if (completed) {
    // the lesson just finished — tell the teacher (self-notification skipped in notify())
    await notify({
      userId: lesson.teacherId,
      actorId: user.id,
      type: "LESSON_COMPLETED",
      title: "درس تعاملی تکمیل شد",
      body: `«${user.fullName}» درس «${lesson.title}» را تکمیل کرد`,
      linkUrl: `#/lesson/${lesson.id}`,
      relatedId: lesson.id,
      relatedType: "interactive-lesson",
    });
  }

  let result: AdvanceResult;
  if (!correct) {
    result = {
      correct: false,
      explanation: step.explanation,
      currentStep: progress.currentStep,
      completed: false,
    };
  } else if (!completed) {
    result = {
      correct: true,
      explanation: null,
      currentStep: progress.currentStep,
      completed: false,
    };
  } else {
    const responses = JSON.parse(progress.responses || "{}") as Record<
      string,
      { answer: string; correct: boolean; attempts: number }
    >;
    const gradedStepCount = lesson.steps.filter((s) => s.type !== "TEXT").length;
    const { firstTryCorrect, totalAttempts } = computeFirstTryCorrect(responses);
    result = {
      correct: true,
      explanation: null,
      currentStep: progress.currentStep,
      completed: true,
      summary: {
        totalSteps: gradedStepCount,
        firstTryCorrect,
        totalAttempts,
      },
    };
  }
  return ok(result);
}
