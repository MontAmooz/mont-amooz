// مُنت‌آموز — line diff (LCS) + contribution scoring
// Shared between API routes (server) and seed script.

export interface LineDiff {
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
}

/** Normalize a line for comparison (trim, collapse spaces). */
function norm(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

/** Count meaningful (non-empty) lines of a markdown text. */
export function countContentLines(text: string): number {
  return text
    .split("\n")
    .filter((l) => norm(l).length > 0).length;
}

/**
 * Classic LCS-based line diff. Returns removed/added lines.
 * Good enough for MVP handout-sized texts (< a few thousand lines).
 */
export function lineDiff(oldText: string, newText: string): LineDiff {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  // Ignore empty lines in diff output but keep alignment by index maps
  const ai = a.map((l, i) => ({ l: norm(l), i })).filter((x) => x.l.length > 0);
  const bi = b.map((l, i) => ({ l: norm(l), i })).filter((x) => x.l.length > 0);

  const n = ai.length;
  const m = bi.length;
  const A = ai.map((x) => x.l);
  const B = bi.map((x) => x.l);

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(a[ai[i].i]);
      i++;
    } else {
      added.push(b[bi[j].i]);
      j++;
    }
  }
  while (i < n) {
    removed.push(a[ai[i].i]);
    i++;
  }
  while (j < m) {
    added.push(b[bi[j].i]);
    j++;
  }

  return {
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
  };
}

/**
 * Compute percentages for contributions so they always sum to 100.
 * Input: array of { userId, score }. Output adds percentage field.
 */
export function computePercentages<T extends { score: number }>(rows: T[]): (T & { percentage: number })[] {
  const total = rows.reduce((s, r) => s + r.score, 0);
  if (total <= 0) {
    return rows.map((r) => ({ ...r, percentage: rows.length ? Math.round(100 / rows.length) : 0 }));
  }
  const raws = rows.map((r) => (r.score / total) * 100);
  const percentages = raws.map((raw) => Math.floor(raw));
  // Distribute remaining points to the largest fractional parts
  let rem = 100 - percentages.reduce((s, p) => s + p, 0);
  const order = raws
    .map((raw, idx) => ({ idx, frac: raw - Math.floor(raw) }))
    .sort((x, y) => y.frac - x.frac);
  let k = 0;
  while (rem > 0 && order.length > 0) {
    percentages[order[k % order.length].idx] += 1;
    rem -= 1;
    k += 1;
  }
  return rows.map((r, idx) => ({ ...r, percentage: percentages[idx] }));
}
