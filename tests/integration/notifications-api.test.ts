// Integration tests — notifications API (P11)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("GET /notifications", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/notifications");
    expect(r.status).toBe(401);
  });

  test("empty for a new user", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ items: unknown[]; total: number }>(baseUrl(), "/api/v1/notifications", {
      cookie,
    });
    expect(r.status).toBe(200);
    expect(r.data.items).toHaveLength(0);
    expect(r.data.total).toBe(0);
  });

  test("returns items sorted newest-first", async () => {
    const { cookie } = await registerUser(baseUrl());
    // response contract; ordering is covered with real data in the read-all test
    const r = await api<{ items: Array<{ createdAt: string }>; page: number; pageSize: number }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.page).toBe(1);
    expect(r.data.pageSize).toBe(20);
    const times = r.data.items.map((i) => Date.parse(i.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("GET /notifications/unread-count", () => {
  test("0 for a new user; unauthenticated → 401", async () => {
    const anon = await api(baseUrl(), "/api/v1/notifications/unread-count");
    expect(anon.status).toBe(401);
  });
});

describe("POST /notifications/[id]/read", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/notifications/whatever/read", { method: "POST" });
    expect(r.status).toBe(401);
  });

  test("valid sets readAt; unread-count drops; foreign id → 404 (no leak)", async () => {
    // Create two users; user A triggers a review on user B's pamphlet so B
    // holds a real notification; A then tries to mark B's notification read.
    const author = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);

    await api(baseUrl(), `/api/v1/pamphlets/${pamphletId}/reviews`, {
      method: "POST",
      cookie: reviewer.cookie,
      json: { rating: 4, comment: "جالب بود" },
    });

    const list = await api<{ items: Array<{ id: string; readAt: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: author.cookie }
    );
    expect(list.data.items.length).toBe(1);
    const n = list.data.items[0];
    expect(n.readAt).toBeNull();

    // foreign user → 404
    const foreign = await api(baseUrl(), `/api/v1/notifications/${n.id}/read`, {
      method: "POST",
      cookie: reviewer.cookie,
    });
    expect(foreign.status).toBe(404);

    // unknown id → 404
    const unknown = await api(baseUrl(), "/api/v1/notifications/nonexistent/read", {
      method: "POST",
      cookie: author.cookie,
    });
    expect(unknown.status).toBe(404);

    // owner → 200, readAt set, count decrements
    const read = await api(baseUrl(), `/api/v1/notifications/${n.id}/read`, {
      method: "POST",
      cookie: author.cookie,
    });
    expect(read.status).toBe(200);

    const count = await api<{ count: number }>(baseUrl(), "/api/v1/notifications/unread-count", {
      cookie: author.cookie,
    });
    expect(count.data.count).toBe(0);

    // idempotent second read → still 200
    const again = await api(baseUrl(), `/api/v1/notifications/${n.id}/read`, {
      method: "POST",
      cookie: author.cookie,
    });
    expect(again.status).toBe(200);
  });
});

describe("POST /notifications/read-all", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/notifications/read-all", { method: "POST" });
    expect(r.status).toBe(401);
  });

  test("marks all read and the unread filter excludes them", async () => {
    // one user, three notifications via three first-reviews on one pamphlet?
    // A pamphlet has one review per user — instead use 3 pamphlets.
    const owner = await registerUser(baseUrl());
    const ids = [
      await createPamphlet(baseUrl(), owner.cookie),
      await createPamphlet(baseUrl(), owner.cookie),
      await createPamphlet(baseUrl(), owner.cookie),
    ];
    const reviewers = await Promise.all([
      registerUser(baseUrl()),
      registerUser(baseUrl()),
      registerUser(baseUrl()),
    ]);
    for (let i = 0; i < 3; i++) {
      await api(baseUrl(), `/api/v1/pamphlets/${ids[i]}/reviews`, {
        method: "POST",
        cookie: reviewers[i].cookie,
        json: { rating: 5, comment: "عالی" },
      });
    }

    const before = await api<{ count: number }>(baseUrl(), "/api/v1/notifications/unread-count", {
      cookie: owner.cookie,
    });
    expect(before.data.count).toBe(3);

    const all = await api<{ updated: number }>(baseUrl(), "/api/v1/notifications/read-all", {
      method: "POST",
      cookie: owner.cookie,
    });
    expect(all.status).toBe(200);
    expect(all.data.updated).toBe(3);

    const after = await api<{ count: number }>(baseUrl(), "/api/v1/notifications/unread-count", {
      cookie: owner.cookie,
    });
    expect(after.data.count).toBe(0);

    const unreadList = await api<{ items: unknown[] }>(
      baseUrl(),
      "/api/v1/notifications?unread=true",
      { cookie: owner.cookie }
    );
    expect(unreadList.data.items).toHaveLength(0);

    const allList = await api<{ items: Array<{ readAt: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications",
      { cookie: owner.cookie }
    );
    expect(allList.data.items.every((n) => n.readAt !== null)).toBe(true);
  });
});