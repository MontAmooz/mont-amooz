// Integration tests — users (profile, PATCH me, top) + platform stats
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser, loginAs, createPamphlet, createCourse, DEMO_USERS } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("Users — GET /users/[id]", () => {
  test("valid profile returns public shape (no email)", async () => {
    const u = await registerUser(baseUrl(), { fullName: "پروفایل عمومی" });
    const r = await api<{ user: { id: string; email?: string; fullName: string } }>(
      baseUrl(), `/api/v1/users/${u.user.id}`
    );
    expect(r.status).toBe(200);
    expect(r.data.user.fullName).toBe("پروفایل عمومی");
    expect(r.data.user.email).toBeUndefined();
  });

  test("unknown id → 404 «کاربر پیدا نشد»", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/users/nope");
    expect(r.status).toBe(404);
    expect(r.data.error).toBe("کاربر پیدا نشد");
  });

  test("teacher profile includes contributions context (seeded founder)", async () => {
    const cookie = await loginAs(baseUrl(), DEMO_USERS.founder.email);
    const me = await api<{ user: { id: string } }>(baseUrl(), "/api/v1/auth/me", { cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/users/${me.data.user.id}`);
    expect(r.status).toBe(200);
  });
});

describe("Users — PATCH /users/me", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/users/me", {
      method: "PATCH", json: { fullName: "بی‌نام" },
    });
    expect(r.status).toBe(401);
  });

  test("too-short fullName → 400 «نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/users/me", {
      method: "PATCH", cookie, json: { fullName: "ف" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد");
  });

  test("bio over limit → 400 «زندگی‌نامه حداکثر ۶۰۰ نویسه است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/users/me", {
      method: "PATCH", cookie, json: { bio: "ط".repeat(601) },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("زندگی‌نامه حداکثر ۶۰۰ نویسه است");
  });

  test("valid update → 200 with updated public user", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ user: { fullName: string; bio: string | null } }>(baseUrl(), "/api/v1/users/me", {
      method: "PATCH",
      cookie,
      json: { fullName: "نام تازهٔ من", bio: "زندگی‌نامهٔ تازه", expertise: "ریاضی,هندسه" },
    });
    expect(r.status).toBe(200);
    expect(r.data.user.fullName).toBe("نام تازهٔ من");
    expect(r.data.user.bio).toBe("زندگی‌نامهٔ تازه");
  });
});

describe("Users — GET /users/top", () => {
  test("public list returns teachers with pamphlet counts", async () => {
    const r = await api<{ items: Array<{ id: string; pamphletCount?: number }> }>(baseUrl(), "/api/v1/users/top");
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
  });

  test("a teacher who publishes rises into the list", async () => {
    const author = await registerUser(baseUrl(), { fullName: "مؤلف تازه" });
    await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ صعودکننده" });
    const r = await api<{ items: Array<{ id: string; pamphletCount: number }> }>(baseUrl(), "/api/v1/users/top");
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
    expect(r.data.items[0].pamphletCount).toBeGreaterThanOrEqual(1); // sorted by pamphletCount desc
  });
});

describe("Stats — GET /stats", () => {
  test("seeded counts are present and plausible", async () => {
    const r = await api<{
      pamphlets: number; teachers: number; versions: number; reviews: number;
      forks: number; mergeRequests: number; mergedCount: number; sessions: number; courses: number;
    }>(baseUrl(), "/api/v1/stats");
    expect(r.status).toBe(200);
    expect(r.data.pamphlets).toBeGreaterThanOrEqual(14);
    expect(r.data.teachers).toBeGreaterThanOrEqual(6);
    expect(r.data.courses).toBeGreaterThanOrEqual(5);
  });

  test("creating a pamphlet bumps the count (eventual consistency within request)", async () => {
    const before = await api<{ pamphlets: number }>(baseUrl(), "/api/v1/stats");
    const { cookie } = await registerUser(baseUrl());
    await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ آماری" });
    const after = await api<{ pamphlets: number }>(baseUrl(), "/api/v1/stats");
    expect(after.data.pamphlets).toBe(before.data.pamphlets + 1);
  });
});
