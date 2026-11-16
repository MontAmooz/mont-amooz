// Unit tests — exam grading pure function (src/lib/exam-grading.ts)
import { describe, test, expect } from "vitest";
import { gradeExam } from "@/lib/exam-grading";

const Q = (id: string, correct: string, points = 1) => ({
  id,
  correctOptionId: correct,
  points,
});

describe("gradeExam", () => {
  const questions = [
    Q("q1", "a1", 2),
    Q("q2", "b2", 3),
    Q("q3", "c3", 5),
  ];

  test("all correct → full score", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "a1", q2: "b2", q3: "c3" },
    });
    expect(r.score).toBe(10);
    expect(r.maxScore).toBe(10);
    expect(r.perQuestion).toEqual({ q1: true, q2: true, q3: true });
  });

  test("all wrong → zero", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "x", q2: "y", q3: "z" },
    });
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(10);
    expect(Object.values(r.perQuestion).every((v) => !v)).toBe(true);
  });

  test("mixed → partial score", () => {
    const r = gradeExam({
      questions,
      answers: { q1: "a1", q2: "wrong", q3: "c3" },
    });
    expect(r.score).toBe(7); // 2 + 0 + 5
    expect(r.perQuestion).toEqual({ q1: true, q2: false, q3: true });
  });

  test("maxScore is the sum of points", () => {
    const r = gradeExam({ questions: [Q("a", "1", 3), Q("b", "2", 4)], answers: {} });
    expect(r.maxScore).toBe(7);
  });

  test("empty answers → zero (but maxScore still counted)", () => {
    const r = gradeExam({ questions, answers: {} });
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(10);
    expect(Object.values(r.perQuestion).every((v) => !v)).toBe(true);
  });
});
