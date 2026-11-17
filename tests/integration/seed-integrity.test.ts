// Integration test — seed integrity (P13)
// Guards future seed regressions: if the seed's footprint ever shrinks below
// the beta thresholds, this fails loudly instead of a silent demo-looking app.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { getSeedCounts } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("Seed integrity (P13)", () => {
  test("seed produces the beta-scale minimum counts", async () => {
    const counts = await getSeedCounts(baseUrl());
    expect(counts.pamphlets).toBeGreaterThanOrEqual(40);
    expect(counts.exams).toBeGreaterThanOrEqual(10);
    expect(counts.courses).toBeGreaterThanOrEqual(15);
    expect(counts.slots).toBeGreaterThanOrEqual(50);
    expect(counts.users).toBeGreaterThanOrEqual(7);
  });
});
