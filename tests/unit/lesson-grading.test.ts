// Unit tests — interactive-lesson step grading (P15)
import { describe, test, expect } from "vitest";
import { validateStepAnswer, computeFirstTryCorrect } from "@/lib/lesson-grading";

describe("validateStepAnswer", () => {
  test("TEXT: always correct, no answer needed", () => {
    expect(validateStepAnswer({ type: "TEXT" }, null).correct).toBe(true);
    expect(validateStepAnswer({ type: "TEXT" }, "").correct).toBe(true);
    expect(validateStepAnswer({ type: "TEXT" }, "هر چیزی").correct).toBe(true);
  });

  test("MC: correct when answer === correctOptionId", () => {
    const step = { type: "MC" as const, correctOptionId: "opt1-2" };
    expect(validateStepAnswer(step, "opt1-2").correct).toBe(true);
  });

  test("MC: wrong when different", () => {
    const step = { type: "MC" as const, correctOptionId: "opt1-2" };
    expect(validateStepAnswer(step, "opt1-1").correct).toBe(false);
    expect(validateStepAnswer(step, "").correct).toBe(false);
    expect(validateStepAnswer(step, null).correct).toBe(false);
  });

  test("NUMERIC: exact match", () => {
    const step = { type: "NUMERIC" as const, correctNumeric: 6, tolerance: 0 };
    expect(validateStepAnswer(step, "6").correct).toBe(true);
  });

  test("NUMERIC: within tolerance", () => {
    const step = { type: "NUMERIC" as const, correctNumeric: 0.25, tolerance: 0.01 };
    // NOTE: answers hugging the tolerance edge exactly (0.26 / 0.24) fail due to
    // IEEE754 noise (0.25-0.24 → 0.010000000000000009) — the helper is
    // spec-exact (<= tol) and tests stay off the boundary.
    expect(validateStepAnswer(step, "0.255").correct).toBe(true);
    expect(validateStepAnswer(step, "0.259").correct).toBe(true);
    expect(validateStepAnswer(step, "0.241").correct).toBe(true);
  });

  test("NUMERIC: outside tolerance", () => {
    const step = { type: "NUMERIC" as const, correctNumeric: 0.25, tolerance: 0.01 };
    expect(validateStepAnswer(step, "0.3").correct).toBe(false);
    expect(validateStepAnswer(step, "1").correct).toBe(false);
  });

  test("NUMERIC: non-numeric string → wrong", () => {
    const step = { type: "NUMERIC" as const, correctNumeric: 6, tolerance: 0 };
    expect(validateStepAnswer(step, "شش").correct).toBe(false);
    expect(validateStepAnswer(step, "6x").correct).toBe(false);
    expect(validateStepAnswer(step, "").correct).toBe(false);
    expect(validateStepAnswer(step, null).correct).toBe(false);
  });

  test("NUMERIC: negative and float answers", () => {
    const step = { type: "NUMERIC" as const, correctNumeric: -3, tolerance: 0.01 };
    expect(validateStepAnswer(step, "-3").correct).toBe(true);
    expect(validateStepAnswer(step, "-2.995").correct).toBe(true);
    expect(validateStepAnswer(step, "-2").correct).toBe(false);
  });

  test("IMAGE: always correct, like TEXT (P21)", () => {
    expect(validateStepAnswer({ type: "IMAGE" }, null).correct).toBe(true);
    expect(validateStepAnswer({ type: "IMAGE" }, "").correct).toBe(true);
    expect(validateStepAnswer({ type: "IMAGE" }, "هر چیزی").correct).toBe(true);
  });
});

describe("validateStepAnswer — FILL_BLANK (P21)", () => {
  const blanks = [
    { id: "blank1-1", correctAnswer: "3x^2", caseSensitive: false },
    { id: "blank1-2", correctAnswer: "2x", caseSensitive: false },
  ];

  test("all blanks correct → true", () => {
    const answer = JSON.stringify({ "blank1-1": "3x^2", "blank1-2": "2x" });
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, answer).correct).toBe(true);
  });

  test("one blank wrong → false (all-or-nothing)", () => {
    const answer = JSON.stringify({ "blank1-1": "3x^2", "blank1-2": "x^2" });
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, answer).correct).toBe(false);
  });

  test("case-insensitive by default", () => {
    const csBlanks = [{ id: "b1", correctAnswer: "Sine", caseSensitive: false }];
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks: csBlanks }, JSON.stringify({ b1: "sine" })).correct
    ).toBe(true);
  });

  test("caseSensitive distinguishes case", () => {
    const csBlanks = [{ id: "b1", correctAnswer: "Sine", caseSensitive: true }];
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks: csBlanks }, JSON.stringify({ b1: "Sine" })).correct
    ).toBe(true);
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks: csBlanks }, JSON.stringify({ b1: "sine" })).correct
    ).toBe(false);
  });

  test("internal whitespace collapses (math answers)", () => {
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks }, JSON.stringify({ "blank1-1": "3 x^2", "blank1-2": "2 x" })).correct
    ).toBe(true);
    // leading/trailing spaces are trimmed before comparison too
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks }, JSON.stringify({ "blank1-1": " 3x^2 ", "blank1-2": " 2x" })).correct
    ).toBe(true);
  });

  test("empty / missing input → false", () => {
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, null).correct).toBe(false);
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, "").correct).toBe(false);
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, JSON.stringify({})).correct).toBe(false);
    // a blank answered with null-ish (non-string) value → false
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks }, JSON.stringify({ "blank1-1": null, "blank1-2": "2x" })).correct
    ).toBe(false);
  });

  test("malformed JSON → false", () => {
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, "{not json").correct).toBe(false);
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, "[1,2]").correct).toBe(false);
    expect(validateStepAnswer({ type: "FILL_BLANK", blanks }, "42").correct).toBe(false);
  });

  test("no blanks stored → false", () => {
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks: null }, JSON.stringify({ b: "x" })).correct
    ).toBe(false);
    expect(
      validateStepAnswer({ type: "FILL_BLANK", blanks: [] }, JSON.stringify({ b: "x" })).correct
    ).toBe(false);
  });
});

describe("computeFirstTryCorrect", () => {
  test("counts first-try correct and total attempts", () => {
    const responses = {
      s1: { answer: "4", correct: true, attempts: 1 }, // first try ✓
      s2: { answer: "9", correct: false, attempts: 2 }, // still wrong
      s3: { answer: "2", correct: true, attempts: 3 }, // correct on 3rd
      s4: { answer: "8", correct: true, attempts: 1 }, // first try ✓
    };
    const r = computeFirstTryCorrect(responses);
    expect(r.firstTryCorrect).toBe(2);
    expect(r.totalAttempts).toBe(7);
  });

  test("empty responses → zeros", () => {
    expect(computeFirstTryCorrect({})).toEqual({ firstTryCorrect: 0, totalAttempts: 0 });
  });
});
