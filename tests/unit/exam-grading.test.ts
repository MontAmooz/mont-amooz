// Unit tests — exam grading pure function (src/lib/exam-grading.ts)
// P12: MC auto-grading. P14: ESSAY questions left for the teacher, mixed
// exams produce hasEssay=true, computeTotalScore combines auto+manual.
import { describe, test, expect } from "vitest";
import { gradeExam, computeTotalScore } from "@/lib/exam-grading";

const MC = (id: string, correct: string, points = 1) => ({
  id,
  type: "MC" as const,
  correctOptionId: correct,
  points,
});
const ESSAY = (id: string, points = 1) => ({
  id,
  type: "ESSAY" as const,
  correctOptionId: null,
  points,
});

describe("gradeExam — MC (P12 behavior preserved)", () => {
  const questions = [
    MC("q1", "a1", 2),
    MC("q2", "b2", 3),
    MC("q3", "c3", 5),
  ];

  test("all correct → full score", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "a1", q2: "b2", q3: "c3" },
    });
    expect(r.autoScore).toBe(10);
    expect(r.maxScore).toBe(10);
    expect(r.hasEssay).toBe(false);
    expect(r.perQuestion).toEqual({
      q1: { isCorrect: true, points: 2 },
      q2: { isCorrect: true, points: 3 },
      q3: { isCorrect: true, points: 5 },
    });
  });

  test("all wrong → zero", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "x", q2: "y", q3: "z" },
    });
    expect(r.autoScore).toBe(0);
    expect(r.maxScore).toBe(10);
    expect(Object.values(r.perQuestion).every((v) => v.isCorrect === false)).toBe(true);
  });

  test("mixed → partial score", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "a1", q2: "wrong", q3: "c3" },
    });
    expect(r.autoScore).toBe(7); // 2 + 0 + 5
    expect(r.perQuestion.q2).toEqual({ isCorrect: false, points: 0 });
  });

  test("maxScore is the sum of points", () => {
    const r = gradeExam({ questions: [MC("a", "1", 3), MC("b", "2", 4)], answers: {} });
    expect(r.maxScore).toBe(7);
  });

  test("empty answers → zero (but maxScore still counted)", () => {
    const r = gradeExam({ questions, answers: {} });
    expect(r.autoScore).toBe(0);
    expect(r.maxScore).toBe(10);
  });
});

describe("gradeExam — ESSAY + mixed (P14)", () => {
  test("ESSAY answer ignored in autoScore; hasEssay true", () => {
    const r = gradeExam({
      questions: [MC("q1", "a1", 4), ESSAY("e1", 6)],
      answers: { q1: "a1", e1: "my long essay text" },
    });
    expect(r.autoScore).toBe(4);
    expect(r.maxScore).toBe(10);
    expect(r.hasEssay).toBe(true);
    expect(r.perQuestion.e1).toEqual({ isCorrect: null, points: null });
    expect(r.perQuestion.q1).toEqual({ isCorrect: true, points: 4 });
  });

  test("hasEssay false when no ESSAY questions", () => {
    const r = gradeExam({ questions: [MC("q1", "a1")], answers: { q1: "a1" } });
    expect(r.hasEssay).toBe(false);
  });

  test("mixed MC+ESSAY: autoScore only from MC", () => {
    const r = gradeExam({
      questions: [ESSAY("e1", 5), MC("q1", "a1", 3), ESSAY("e2", 2)],
      answers: { q1: "wrong" },
    });
    expect(r.autoScore).toBe(0);
    expect(r.maxScore).toBe(10);
    expect(r.hasEssay).toBe(true);
  });
});

describe("computeTotalScore", () => {
  test("null manualScore → autoScore", () => {
    expect(computeTotalScore(7, null)).toBe(7);
  });

  test("manualScore present → sum", () => {
    expect(computeTotalScore(7, 3)).toBe(10);
  });

  test("zero manualScore → autoScore", () => {
    expect(computeTotalScore(7, 0)).toBe(7);
  });
});
