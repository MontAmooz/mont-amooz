// POST /api/v1/interactive-lessons/[id]/advance — the core player action (P15, P21).
// stepIndex must equal the progress cursor, correctness is graded server-side
// (validateStepAnswer). P21 branching: on correct the cursor jumps to the
// step's nextOnCorrect target (else sequential +1); on wrong it jumps to the
// nextOnWrong target (else stays — retry). IMAGE steps are read-only like TEXT
// (no responses recorded, so firstTryCorrect stats stay meaningful).
import { db } from "@/lib/db";
import { faDigitsToLatin, normalizePersian } from "@/lib/format";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { validateStepAnswer, computeFirstTryCorrect, type StepGradingInput } from "@/lib/lesson-grading";
import { stepBlanks } from "@/lib/server/serializers";
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
          blanks: true,
          explanation: true,
          nextOnCorrectId: true,
          nextOnWrongId: true,
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
  // separators — normalize before Number() (P15 escape-hatch #2). FILL_BLANK
  // values get digit-only conversion per blank — normalizePersian would
  // lowercase them and break caseSensitive blanks (P21).
  let gradedAnswer = answer;
  if (step.type === "NUMERIC" && answer !== null) {
    gradedAnswer = normalizePersian(answer).replace(/[,٬\s]/g, "");
  }
  if (step.type === "FILL_BLANK" && answer !== null) {
    try {
      const parsed: unknown = JSON.parse(answer);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string") normalized[k] = faDigitsToLatin(v);
        }
        gradedAnswer = JSON.stringify(normalized);
      }
    } catch {
      // leave as-is — validateStepAnswer rejects malformed JSON
    }
  }
  const { correct } = validateStepAnswer(
    {
      type: step.type as StepGradingInput["type"],
      correctOptionId: step.correctOptionId,
      correctNumeric: step.correctNumeric,
      tolerance: step.tolerance,
      blanks:
        step.type === "FILL_BLANK"
          ? stepBlanks(step).map((b) => ({
              id: b.id,
              correctAnswer: b.correctAnswer,
              caseSensitive: b.caseSensitive ?? false,
            }))
          : null,
    },
    gradedAnswer
  );

  // P21 — branch targets resolve inside this lesson's own steps; a dangling
  // target (deleted sibling via SetNull is prevented by the FK, but a
  // cross-lesson id would simply not be found here) falls back to sequential
  const branchTargetOrder = (branchId: string | null): number | null => {
    if (!branchId) return null;
    const target = lesson.steps.find((s) => s.id === branchId);
    return target ? target.order : null;
  };

  // read-only content steps (TEXT/IMAGE) — no response recorded
  const ungraded = step.type === "TEXT" || step.type === "IMAGE";

  // record the attempt (graded steps only)
  let completed = false;
  const now = new Date();
  if (!ungraded) {
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
      // correct → nextOnCorrect jump, else sequential advance
      const nextStep = branchTargetOrder(step.nextOnCorrectId) ?? progress.currentStep + 1;
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
      // wrong → nextOnWrong jump (typically an explanation step), else stay/retry
      const wrongTarget = branchTargetOrder(step.nextOnWrongId);
      progress = await db.interactiveLessonProgress.update({
        where: { id: progress.id },
        data: {
          responses: JSON.stringify(responses),
          ...(wrongTarget !== null ? { currentStep: wrongTarget } : {}),
        },
      });
    }
  } else if (correct) {
    // TEXT/IMAGE step — no response recorded; just move the cursor (honoring
    // nextOnCorrect so a remediation explanation can loop back to its question)
    const nextStep = branchTargetOrder(step.nextOnCorrectId) ?? progress.currentStep + 1;
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
    const gradedStepCount = lesson.steps.filter((s) => s.type !== "TEXT" && s.type !== "IMAGE").length;
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
