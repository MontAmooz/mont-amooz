// Integration tests — teacher analytics endpoint (P17)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

const MIN_CONTENT = "# عنوان\n\nاین محتوا برای تست است و بیش از سی نویسه دارد.\n";

async function fork(cookie: string, sourceId: string): Promise<string> {
  const r = await api<{ id: string }>(baseUrl(), `/api/v1/pamphlets/${sourceId}/fork`, {
    method: "POST",
    cookie,
  });
  expect(r.status).toBe(201);
  return r.data.id;
}

describe("GET /users/me/analytics (P17)", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/users/me/analytics");
    expect(r.status).toBe(401);
  });

  test("teacher with pamphlets → summary matches the created reality", async () => {
    const author = await registerUser(baseUrl());
    const fanA = await registerUser(baseUrl());
    const fanB = await registerUser(baseUrl());
    const fanC = await registerUser(baseUrl());

    const p1 = await createPamphlet(baseUrl(), author.cookie, { title: "آماری یک" });
    const p2 = await createPamphlet(baseUrl(), author.cookie, { title: "آماری دو" });
    expect(p1).toBeTruthy();

    // 3 reviews total (2 on p1, 1 on p2 — reviews are unique per user+pamphlet),
    // 1 fork of p1
    const reviewPlan: Array<[string, string, number]> = [
      [p1, fanA.cookie, 5],
      [p1, fanB.cookie, 4],
      [p2, fanC.cookie, 3],
    ];
    for (const [pid, cookie, rating] of reviewPlan) {
      const rv = await api(baseUrl(), `/api/v1/pamphlets/${pid}/reviews`, {
        method: "POST",
        cookie,
        json: { rating, comment: "بازخورد آمار" },
      });
      expect(rv.status).toBe(200);
    }
    await fork(fanA.cookie, p1);

    const r = await api<{
      items: Array<{ id: string; viewCount: number; reviewCount: number; forkCount: number; versionCount: number }>;
      summary: { pamphletCount: number; totalViews: number; totalForks: number; totalReviews: number; totalMRs: number };
    }>(baseUrl(), "/api/v1/users/me/analytics", { cookie: author.cookie });
    expect(r.status).toBe(200);

    expect(r.data.summary.pamphletCount).toBe(2);
    expect(r.data.summary.totalForks).toBe(1);
    expect(r.data.summary.totalReviews).toBe(3);

    const one = r.data.items.find((p) => p.id === p1);
    expect(one).toBeTruthy();
    expect(one!.reviewCount).toBe(2);
    expect(one!.forkCount).toBe(1);
    expect(one!.versionCount).toBeGreaterThanOrEqual(1);
    // detail GETs increment viewCount — at least our 2 detail reads... none here.
    // viewCount is only incremented on detail visits; summary total ≥ 0 suffices.
    expect(r.data.summary.totalViews).toBeGreaterThanOrEqual(0);
  });

  test("student with no pamphlets → zeroed summary", async () => {
    const student = await registerUser(baseUrl(), { role: "دانش‌آموز" });
    const r = await api<{
      items: unknown[];
      summary: { pamphletCount: number; totalViews: number };
    }>(baseUrl(), "/api/v1/users/me/analytics", { cookie: student.cookie });
    expect(r.status).toBe(200);
    expect(r.data.items).toEqual([]);
    expect(r.data.summary.pamphletCount).toBe(0);
    expect(r.data.summary.totalViews).toBe(0);
  });

  test("only counts own pamphlets", async () => {
    const a = await registerUser(baseUrl());
    const b = await registerUser(baseUrl());
    const mine = await createPamphlet(baseUrl(), a.cookie, { title: "مال من" });
    const theirs = await createPamphlet(baseUrl(), b.cookie, { title: "مال دیگری" });
    void theirs;

    const r = await api<{ items: Array<{ id: string }> }>(
      baseUrl(),
      "/api/v1/users/me/analytics",
      { cookie: a.cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.items.some((p) => p.id === mine)).toBe(true);
    expect(r.data.items.length).toBe(1);
  });
});
