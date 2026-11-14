// Integration tests — admin panel + admin-token password reset (P10)
import { describe, test, expect } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { api, DEMO_USERS, loginAs, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

/** The founder is the only seeded admin (P10). */
async function adminCookie(): Promise<string> {
  return loginAs(baseUrl(), DEMO_USERS.founder.email, DEMO_USERS.founder.password);
}

describe("GET /admin/users", () => {
  test("non-admin → 403 «دسترسی ندارید»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/admin/users", { cookie });
    expect(r.status).toBe(403);
    expect((r.data as { error: string }).error).toBe("دسترسی ندارید");
  });

  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/admin/users");
    expect(r.status).toBe(401);
  });

  test("admin → 200 with seed users visible + wallet + counts", async () => {
    const cookie = await adminCookie();
    const r = await api<{
      items: Array<{
        id: string; email: string; isAdmin: boolean; walletBalance: number | null;
        pamphletCount: number; enrollmentCount: number;
      }>;
      total: number; page: number; pageSize: number;
    }>(baseUrl(), "/api/v1/admin/users?page=1&pageSize=20", { cookie });
    expect(r.status).toBe(200);
    // the shared throwaway DB accumulates registrations from earlier files —
    // assert the seed users are IN there, not an exact total
    expect(r.data.total).toBeGreaterThanOrEqual(7);
    expect(r.data.items.length).toBeGreaterThan(0);
    expect(r.data.items.length).toBeLessThanOrEqual(20);
    // emails are exposed only to the admin
    expect(r.data.items.every((u) => u.email.includes("@"))).toBe(true);

    // the founder is the OLDEST user (newest-first sort) → last page
    const lastPage = Math.ceil(r.data.total / 20);
    const last = await api<{
      items: Array<{
        email: string; isAdmin: boolean; walletBalance: number | null; pamphletCount: number;
      }>;
    }>(baseUrl(), `/api/v1/admin/users?page=${lastPage}&pageSize=20`, { cookie });
    expect(last.status).toBe(200);
    const founder = last.data.items.find((u) => u.email === DEMO_USERS.founder.email);
    expect(founder).toBeTruthy();
    expect(founder?.isAdmin).toBe(true);
    expect(founder?.walletBalance).not.toBeNull();
    expect(founder?.pamphletCount).toBeGreaterThan(0);
  });

  test("pagination respects pageSize", async () => {
    const cookie = await adminCookie();
    const r = await api<{ items: unknown[]; page: number }>(
      baseUrl(),
      "/api/v1/admin/users?page=1&pageSize=3",
      { cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.items).toHaveLength(3);
    expect(r.data.page).toBe(1);
  });
});

describe("POST /admin/users/[id]/reset", () => {
  test("non-admin → 403", async () => {
    const { cookie } = await registerUser(baseUrl());
    const target = await registerUser(baseUrl());
    const r = await api(baseUrl(), `/api/v1/admin/users/${target.user.id}/reset`, {
      method: "POST",
      cookie,
    });
    expect(r.status).toBe(403);
  });

  test("admin → 201 with a 32-char token; unknown user → 404; admin target → 400", async () => {
    const cookie = await adminCookie();
    const target = await registerUser(baseUrl());

    const okRes = await api<{ token: string; expiresAt: string }>(
      baseUrl(),
      `/api/v1/admin/users/${target.user.id}/reset`,
      { method: "POST", cookie }
    );
    expect(okRes.status).toBe(201);
    expect(okRes.data.token).toMatch(/^[0-9A-F]{32}$/);
    expect(new Date(okRes.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const unknown = await api(baseUrl(), "/api/v1/admin/users/nonexistent-id/reset", {
      method: "POST",
      cookie,
    });
    expect(unknown.status).toBe(404);

    // the admin resetting their own account — get the id from /auth/me (the
    // admin list is newest-first and the founder is the OLDEST user, so with
    // 100+ registrations in the shared DB he isn't on page 1)
    const me = await api<{ user: { id: string; isAdmin: boolean } }>(
      baseUrl(),
      "/api/v1/auth/me",
      { cookie }
    );
    expect(me.data.user.isAdmin).toBe(true);
    const adminTarget = await api(baseUrl(), `/api/v1/admin/users/${me.data.user.id}/reset`, {
      method: "POST",
      cookie,
    });
    expect(adminTarget.status).toBe(400);
    expect((adminTarget.data as { error: string }).error).toBe(
      "نمی‌توانید رمز مدیر را بازنشانی کنید"
    );
  });

  test("issuing a new token invalidates previous unused ones", async () => {
    const cookie = await adminCookie();
    const target = await registerUser(baseUrl());
    const first = await api<{ token: string }>(
      baseUrl(),
      `/api/v1/admin/users/${target.user.id}/reset`,
      { method: "POST", cookie }
    );
    const second = await api<{ token: string }>(
      baseUrl(),
      `/api/v1/admin/users/${target.user.id}/reset`,
      { method: "POST", cookie }
    );
    const useOld = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: first.data.token, newPassword: "expired-token-pass" },
    });
    expect(useOld.status).toBe(400);
    expect((useOld.data as { error: string }).error).toBe("این کد قبلاً استفاده شده است");

    // the newest token still works
    const useNew = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: second.data.token, newPassword: "fresh-token-pass" },
    });
    expect(useNew.status).toBe(200);
  });
});

describe("POST /auth/reset/confirm", () => {
  test("invalid token → 400 «کد نامعتبر است»", async () => {
    const r = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: "DEADBEEFDEADBEEFDEADBEEFDEADBEEF", newPassword: "some-long-pass" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("کد نامعتبر است");
  });

  test("short password → 400", async () => {
    const r = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: "DEADBEEFDEADBEEFDEADBEEFDEADBEEF", newPassword: "short" },
    });
    expect(r.status).toBe(400);
  });

  test("valid token updates the password; token is single-use", async () => {
    const cookie = await adminCookie();
    const email = `reset-me-${Date.now()}@example.com`;
    await registerUser(baseUrl(), { email });
    const target = await api<{ items: Array<{ id: string; email: string }> }>(
      baseUrl(),
      "/api/v1/admin/users?pageSize=50",
      { cookie }
    );
    const targetId = target.data.items.find((u) => u.email === email)!.id;

    const issued = await api<{ token: string }>(
      baseUrl(),
      `/api/v1/admin/users/${targetId}/reset`,
      { method: "POST", cookie }
    );
    expect(issued.status).toBe(201);

    const confirm = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: issued.data.token, newPassword: "reset-pass-12345" },
    });
    expect(confirm.status).toBe(200);

    const login = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "reset-pass-12345" },
    });
    expect(login.status).toBe(200);

    const reuse = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: issued.data.token, newPassword: "another-pass-123" },
    });
    expect(reuse.status).toBe(400);
    expect((reuse.data as { error: string }).error).toBe("این کد قبلاً استفاده شده است");
  });

  test("expired token → 400 «این کد منقضی شده است» (expiresAt wound back in the throwaway DB)", async () => {
    const cookie = await adminCookie();
    const target = await registerUser(baseUrl());
    const issued = await api<{ token: string }>(
      baseUrl(),
      `/api/v1/admin/users/${target.user.id}/reset`,
      { method: "POST", cookie }
    );

    // The vitest run has one throwaway DB (/tmp/oeg-test-*.db) — rewind the
    // token's expiry to exercise the expiry branch. Stale DBs from crashed
    // prior runs may exist, so UPDATE across all of them: only the one holding
    // this unique token is affected. (readdirSync — fs.globSync is Node 22+;
    // CI runs Node 20.)
    const dbs = fs
      .readdirSync("/tmp")
      .filter((f) => /^oeg-test-\d+\.db$/.test(f))
      .map((f) => `/tmp/${f}`);
    expect(dbs.length).toBeGreaterThan(0);
    for (const dbPath of dbs) {
      execSync(
        `sqlite3 "${dbPath}" "UPDATE PasswordResetToken SET expiresAt = datetime('now','-1 hour') WHERE token = '${issued.data.token}';"`
      );
    }

    const r = await api(baseUrl(), "/api/v1/auth/reset/confirm", {
      method: "POST",
      json: { token: issued.data.token, newPassword: "too-late-pass" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("این کد منقضی شده است");
  });
});
