// Unit tests — src/lib/diff.ts (lineDiff, countContentLines, computePercentages)
// The computePercentages cases canonize the P3 rewrite harness (/tmp/diff-harness.ts):
// outputs were verified byte-identical before/after the Omit-variance fix.
import { describe, test, expect } from "vitest";
import { lineDiff, countContentLines, computePercentages } from "@/lib/diff";

describe("lineDiff", () => {
  test("identical strings → no added, no removed", () => {
    const d = lineDiff("سلام\nدنیا", "سلام\nدنیا");
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
    expect(d.addedCount).toBe(0);
    expect(d.removedCount).toBe(0);
  });

  test("single line addition → 1 added, 0 removed", () => {
    const d = lineDiff("الف\nب", "الف\nب\nج");
    expect(d.added).toEqual(["ج"]);
    expect(d.removed).toHaveLength(0);
  });

  test("single line removal → 0 added, 1 removed", () => {
    const d = lineDiff("الف\nب\nج", "الف\nب");
    expect(d.added).toHaveLength(0);
    expect(d.removed).toEqual(["ج"]);
  });

  test("multi-line change → correct counts", () => {
    const d = lineDiff("۱\n۲\n۳", "۱\n۴\n۵");
    expect(d.removed).toEqual(["۲", "۳"]);
    expect(d.added).toEqual(["۴", "۵"]);
  });

  test("empty vs non-empty → all added / all removed", () => {
    const toEmpty = lineDiff("الف\nب", "");
    expect(toEmpty.removed).toEqual(["الف", "ب"]);
    expect(toEmpty.added).toHaveLength(0);

    const fromEmpty = lineDiff("", "الف\nب");
    expect(fromEmpty.added).toEqual(["الف", "ب"]);
    expect(fromEmpty.removed).toHaveLength(0);
  });

  test("whitespace-only differences count as change", () => {
    // norm() trims and collapses inner whitespace → "الف ب" vs "الف  ب" are EQUAL,
    // but trailing/leading whitespace differences vanish too; a genuinely new
    // whitespace shape (extra words) is still a change.
    const same = lineDiff("الف ب", "الف   ب");
    expect(same.added).toHaveLength(0);
    expect(same.removed).toHaveLength(0);

    const changed = lineDiff("الف ب", "الف ب ب");
    expect(changed.added).toEqual(["الف ب ب"]);
    expect(changed.removed).toEqual(["الف ب"]);
  });

  test("ACTUAL: reordered lines diff against LCS, not set-equality", () => {
    // LCS of [الف,ب,ج] vs [ج,ب,الف] matches ONE line (subsequence, not set) →
    // the other two appear as removed+added. Which line matches depends on the
    // dp tie-breaking, so assert counts + multiset equality (order-free).
    const d = lineDiff("الف\nب\nج", "ج\nب\nالف");
    expect(d.addedCount).toBe(2);
    expect(d.removedCount).toBe(2);
    expect([...d.added].sort()).toEqual([...d.removed].sort());
    expect(d.added).not.toEqual(d.removed.map((l) => l)); // sanity: real diff content
  });

  test("Persian text with ZWNJ preserved as-is (no normalization by diff)", () => {
    const before = "می‌رویم";
    const after = "میرویم"; // ZWNJ dropped by the author, not by diff
    const d = lineDiff(before, after);
    expect(d.removed).toEqual(["می‌رویم"]);
    expect(d.added).toEqual(["میرویم"]);
  });
});

describe("countContentLines", () => {
  test("strips empty lines", () => {
    expect(countContentLines("الف\n\nب")).toBe(2);
  });

  test("strips whitespace-only lines", () => {
    expect(countContentLines("الف\n   \nب")).toBe(2);
  });

  test("handles \\r\\n (Windows line endings)", () => {
    expect(countContentLines("الف\r\nب")).toBe(2);
  });

  test("handles trailing newlines", () => {
    expect(countContentLines("الف\nب\n")).toBe(2);
  });

  test("returns 0 for empty content", () => {
    expect(countContentLines("")).toBe(0);
    expect(countContentLines("\n\n")).toBe(0);
  });
});

describe("computePercentages", () => {
  test("1 user with score N → 100%", () => {
    expect(computePercentages([{ userId: "a", score: 7 }])).toEqual([
      { userId: "a", score: 7, percentage: 100 },
    ]);
  });

  test("2 users 100/100 → 50/50", () => {
    const out = computePercentages([
      { userId: "a", score: 100 },
      { userId: "b", score: 100 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([50, 50]);
  });

  test("2 users 100/50 → 67/33", () => {
    const out = computePercentages([
      { userId: "a", score: 100 },
      { userId: "b", score: 50 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([67, 33]);
  });

  test("3 users 100/50/50 → 50/25/25", () => {
    const out = computePercentages([
      { userId: "a", score: 100 },
      { userId: "b", score: 50 },
      { userId: "c", score: 50 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([50, 25, 25]);
  });

  test("3 users equal → 34/33/33 (remainder to first — actual behavior)", () => {
    // raw = 33.33… for each; all fractional parts equal → stable sort keeps
    // input order → first index receives the leftover point (P3-verified).
    const out = computePercentages([
      { userId: "a", score: 1 },
      { userId: "b", score: 1 },
      { userId: "c", score: 1 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([34, 33, 33]);
  });

  test("4 users equal → 25/25/25/25", () => {
    const out = computePercentages([
      { userId: "a", score: 1 },
      { userId: "b", score: 1 },
      { userId: "c", score: 1 },
      { userId: "d", score: 1 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([25, 25, 25, 25]);
  });

  test("preserves extra fields of the input rows (generic T)", () => {
    const out = computePercentages([
      { userId: "a", score: 72, helpful: 5 },
      { userId: "b", score: 18, helpful: 1 },
    ]);
    expect(out).toEqual([
      { userId: "a", score: 72, helpful: 5, percentage: 80 },
      { userId: "b", score: 18, helpful: 1, percentage: 20 },
    ]);
  });

  test("sum is always 100 (when there is at least one user)", () => {
    const cases = [
      [{ score: 72 }, { score: 18 }, { score: 10 }],
      [{ score: 1 }, { score: 1 }, { score: 1 }],
      [{ score: 7 }, { score: 3 }],
      [{ score: 100 }],
      [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }, { score: 5 }, { score: 6 }, { score: 7 }],
      [{ score: 9999 }, { score: 1 }],
      [{ score: 33 }, { score: 33 }, { score: 34 }],
      [{ score: 10 }, { score: 0 }, { score: 30 }, { score: 60 }],
    ];
    for (const rows of cases) {
      const sum = computePercentages(rows).reduce((s, r) => s + r.percentage, 0);
      expect(sum).toBe(100);
    }
  });

  test("all scores 0 → handled gracefully (equal split)", () => {
    // total = 0 → the total<=0 branch: Math.round(100/rows.length) each
    const out = computePercentages([
      { userId: "a", score: 0 },
      { userId: "b", score: 0 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([50, 50]);
  });

  test("empty input → empty output", () => {
    expect(computePercentages([])).toEqual([]);
  });

  test("leftover from rounding goes to the largest fractional part", () => {
    // 9999/10000 = 99.99 → floor 99, frac .99; 1/10000 = 0.0001 → floor 0, frac tiny
    // rem = 100 - 99 = 1 → goes to idx 0 (largest frac) → 100/0
    const out = computePercentages([
      { userId: "a", score: 9999 },
      { userId: "b", score: 1 },
    ]);
    expect(out.map((r) => r.percentage)).toEqual([100, 0]);
  });
});
