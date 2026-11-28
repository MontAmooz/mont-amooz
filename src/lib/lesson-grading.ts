// مُنت‌آموز — server-side interactive-lesson step grading (P15, P21).
// Pure functions: the client never decides correctness — it sends the raw
// answer and the server grades against the stored correct values.
// TEXT and IMAGE steps are read-only content (no answer to grade).

export type StepGradingInput = {
  type: "TEXT" | "MC" | "NUMERIC" | "FILL_BLANK" | "IMAGE";
  correctOptionId?: string | null;
  correctNumeric?: number | null;
  tolerance?: number | null;
  blanks?: Array<{ id: string; correctAnswer: string; caseSensitive: boolean }> | null;
};

/** Grade one step answer. TEXT/IMAGE are always correct (advancing is the whole
 * point); MC compares the submitted option id; NUMERIC compares with tolerance;
 * FILL_BLANK parses the JSON `{ [blankId]: string }` and requires EVERY blank to
 * match (all-or-nothing, like MC/NUMERIC — P21 MVP decision). Blank comparison
 * trims, collapses internal whitespace ("3 x^2" == "3x^2") and is
 * case-insensitive unless the blank opted into caseSensitive. */
export function validateStepAnswer(
  step: StepGradingInput,
  answer: string | null
): { correct: boolean } {
  if (step.type === "TEXT" || step.type === "IMAGE") return { correct: true };
  if (answer === null || answer === "") return { correct: false };

  if (step.type === "MC") {
    return { correct: answer === step.correctOptionId };
  }

  if (step.type === "NUMERIC") {
    const n = Number(answer);
    if (!Number.isFinite(n)) return { correct: false };
    const target = step.correctNumeric ?? 0;
    const tol = step.tolerance ?? 0;
    return { correct: Math.abs(n - target) <= tol };
  }

  if (step.type === "FILL_BLANK") {
    // answer is JSON: { [blankId]: string }
    let parsed: Record<string, string> = {};
    try {
      const raw: unknown = JSON.parse(answer);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { correct: false };
      parsed = raw as Record<string, string>;
    } catch {
      return { correct: false };
    }
    if (!step.blanks || step.blanks.length === 0) return { correct: false };

    for (const blank of step.blanks) {
      const raw = typeof parsed[blank.id] === "string" ? parsed[blank.id] : "";
      const userVal = blank.caseSensitive ? raw.trim() : raw.trim().toLowerCase();
      const correct = blank.caseSensitive
        ? blank.correctAnswer.trim()
        : blank.correctAnswer.trim().toLowerCase();
      // collapse internal whitespace for math answers like "3 x^2" vs "3x^2"
      const normalizedUser = userVal.replace(/\s+/g, "");
      const normalizedCorrect = correct.replace(/\s+/g, "");
      if (normalizedUser !== normalizedCorrect) return { correct: false };
    }
    return { correct: true };
  }

  return { correct: false };
}

/** First-try-correct and total attempts across the recorded (graded) steps. */
export function computeFirstTryCorrect(
  responses: Record<string, { answer: string; correct: boolean; attempts: number }>
): { firstTryCorrect: number; totalAttempts: number } {
  let firstTryCorrect = 0;
  let totalAttempts = 0;
  for (const r of Object.values(responses)) {
    totalAttempts += r.attempts;
    if (r.correct && r.attempts === 1) firstTryCorrect += 1;
  }
  return { firstTryCorrect, totalAttempts };
}
