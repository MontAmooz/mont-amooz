// مُنت‌آموز — server-side exam grading (P12, extended in P14 for essays).
// Pure function: never trust the client's score. MC questions auto-grade;
// ESSAY questions are left for the teacher (hasEssay flag drives the attempt
// status: SUBMITTED vs GRADED).
export type GradableQuestion = {
  id: string;
  type: "MC" | "ESSAY";
  correctOptionId: string | null;
  points: number;
};

export type GradingInput = {
  questions: GradableQuestion[];
  answers: Record<string, string>; // optionId for MC, free text for ESSAY
};

export type GradingResult = {
  autoScore: number;
  maxScore: number;
  perQuestion: Record<string, { isCorrect: boolean | null; points: number | null }>;
  hasEssay: boolean;
};

export function gradeExam(input: GradingInput): GradingResult {
  let autoScore = 0;
  let maxScore = 0;
  let hasEssay = false;
  const perQuestion: GradingResult["perQuestion"] = {};
  for (const q of input.questions) {
    maxScore += q.points;
    if (q.type === "ESSAY") {
      hasEssay = true;
      perQuestion[q.id] = { isCorrect: null, points: null };
    } else {
      const isCorrect = input.answers[q.id] === q.correctOptionId;
      if (isCorrect) autoScore += q.points;
      perQuestion[q.id] = { isCorrect, points: isCorrect ? q.points : 0 };
    }
  }
  return { autoScore, maxScore, perQuestion, hasEssay };
}

/** Total = auto-graded MC points + teacher-awarded essay points (if any). */
export function computeTotalScore(autoScore: number, manualScore: number | null): number {
  return autoScore + (manualScore ?? 0);
}
