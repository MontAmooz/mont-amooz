// مُنت‌آموز — server-side interactive-lesson step grading (P15).
// Pure functions: the client never decides correctness — it sends the raw
// answer and the server grades against the stored correct values.
// TEXT steps are read-only content (no answer to grade).

export type StepGradingInput = {
  type: "TEXT" | "MC" | "NUMERIC";
  correctOptionId?: string | null;
  correctNumeric?: number | null;
  tolerance?: number | null;
};

/** Grade one step answer. TEXT is always correct (advancing is the whole point);
 * MC compares the submitted option id; NUMERIC compares with tolerance. */
export function validateStepAnswer(
  step: StepGradingInput,
  answer: string | null
): { correct: boolean } {
  if (step.type === "TEXT") return { correct: true };
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
