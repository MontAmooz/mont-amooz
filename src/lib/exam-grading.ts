// مُنت‌آموز — server-side exam grading (P12).
// Pure function: never trust the client's score. Answers that reference an
// unknown question or option simply grade as wrong (the attempt route
// validates referential integrity separately for a clean 400).
export type GradingInput = {
  questions: Array<{ id: string; correctOptionId: string; points: number }>;
  answers: Record<string, string>;
};

export type GradingResult = {
  score: number;
  maxScore: number;
  perQuestion: Record<string, boolean>;
};

export function gradeExam(input: GradingInput): GradingResult {
  let score = 0;
  let maxScore = 0;
  const perQuestion: Record<string, boolean> = {};
  for (const q of input.questions) {
    maxScore += q.points;
    const isCorrect = input.answers[q.id] === q.correctOptionId;
    if (isCorrect) score += q.points;
    perQuestion[q.id] = isCorrect;
  }
  return { score, maxScore, perQuestion };
}
