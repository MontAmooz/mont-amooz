// Integration tests — moderation toolkit (P20)
// POST /reports + GET /admin/reports + resolve + hide + suspend + dashboard.
// Suspension mechanics: login refuses with 403; getCurrentUser() returns null
// so an existing session dies on its next request.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import {
  api,
  createPamphlet,
  DEMO_USERS,
  loginAs,
  registerUser,
} from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

/** Post a comment on a pamphlet (P19 endpoint) → { id }. */
async function postComment(cookie: string, pamphletId: string, body: string) {
  const r = await api<{ id: string }>(baseUrl(), `/api/v1/pamphlets/${pamphletId}/comments`, {
    method: "POST",
    cookie,
    json: { body },
  });
  expect(r.status).toBe(201);
  return r.data;
}

type ReportItem = {
  id: string;
  targetType: "pamphlet" | "comment";
  targetId: string;
  targetSummary: string;
  targetUrl: string;
  reason: string;
  details: string | null;
  status: "PENDING" | "DISMISSED" | "ACTION_TAKEN";
  reporter: { id: string; fullName: string };
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  createdAt: string;
};

const adminCookie = () => loginAs(baseUrl(), DEMO_USERS.founder.email, DEMO_USERS.founder.password);

async function createReport(cookie: string, json: Record<string, unknown>) {
  return api<{ id: string }>(baseUrl(), "/api/v1/reports", { method: "POST", cookie, json });
}

describe("POST /reports (P20)", () => {
  test("unauthenticated → 401", async () => {
    const r = await createReport("", { targetType: "pamphlet", targetId: "x", reason: "spam" });
    expect(r.status).toBe(401);
  });

  test("invalid targetType → 400", async () => {
    const u = await registerUser(baseUrl());
    const r = await createReport(u.cookie, { targetType: "exam", targetId: "x", reason: "spam" });
    expect(r.status).toBe(400);
  });

  test("invalid reason → 400", async () => {
    const u = await registerUser(baseUrl());
    const r = await createReport(u.cookie, { targetType: "pamphlet", targetId: "x", reason: "vibes" });
    expect(r.status).toBe(400);
  });

  test("details > 500 chars → 400", async () => {
    const u = await registerUser(baseUrl());
    const r = await createReport(u.cookie, {
      targetType: "pamphlet", targetId: "x", reason: "spam", details: "الف".repeat(501),
    });
    expect(r.status).toBe(400);
  });

  test("own pamphlet → 400 «نمی‌توانید محتوای خودتان را گزارش دهید»", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await createReport(author.cookie, { targetType: "pamphlet", targetId: pid, reason: "spam" });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("نمی‌توانید محتوای خودتان را گزارش دهید");
  });

  test("same target twice → 409 «قبلاً این محتوا را گزارش کرده‌اید»", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const reporter = await registerUser(baseUrl());
    const first = await createReport(reporter.cookie, { targetType: "pamphlet", targetId: pid, reason: "spam" });
    expect(first.status).toBe(201);
    const second = await createReport(reporter.cookie, { targetType: "pamphlet", targetId: pid, reason: "other" });
    expect(second.status).toBe(409);
    expect((second.data as unknown as { error: string }).error).toBe("قبلاً این محتوا را گزارش کرده‌اید");
  });

  test("valid pamphlet report → 201 and every admin notified", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ گزارش‌شدنی" });
    const reporter = await registerUser(baseUrl());
    const r = await createReport(reporter.cookie, {
      targetType: "pamphlet", targetId: pid, reason: "copyright", details: "کپی‌برداری از کتاب درسی",
    });
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();

    const notes = await api<{ items: Array<{ type: string; title: string }> }>(
      baseUrl(),
      "/api/v1/notifications?pageSize=50",
      { cookie: await adminCookie() }
    );
    const hit = notes.data.items.find((n) => n.type === "ADMIN_REPORT_CREATED");
    expect(hit).toBeTruthy();
    expect(hit!.title).toBe("گزارش جدید ثبت شد");
  });

  test("valid comment report → 201", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const commenter = await registerUser(baseUrl());
    const c = await postComment(commenter.cookie, pid, "پیام گزارش‌شدنی");
    const reporter = await registerUser(baseUrl());
    const r = await createReport(reporter.cookie, {
      targetType: "comment", targetId: c.id, reason: "harassment",
    });
    expect(r.status).toBe(201);
  });

  test("nonexistent pamphlet target → 404 «جزوه پیدا نشد»", async () => {
    const u = await registerUser(baseUrl());
    const r = await createReport(u.cookie, { targetType: "pamphlet", targetId: "nope", reason: "spam" });
    expect(r.status).toBe(404);
    expect((r.data as unknown as { error: string }).error).toBe("جزوه پیدا نشد");
  });

  test("nonexistent comment target → 404 «پیام پیدا نشد»", async () => {
    const u = await registerUser(baseUrl());
    const r = await createReport(u.cookie, { targetType: "comment", targetId: "nope", reason: "spam" });
    expect(r.status).toBe(404);
    expect((r.data as unknown as { error: string }).error).toBe("پیام پیدا نشد");
  });
});

describe("GET /admin/reports (P20)", () => {
  test("non-admin → 403", async () => {
    const u = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/admin/reports", { cookie: u.cookie });
    expect(r.status).toBe(403);
  });

  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/admin/reports");
    expect(r.status).toBe(401);
  });

  test("admin default filter returns only PENDING with hydrated summaries", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ صف" });
    const r1 = await registerUser(baseUrl());
    const r2 = await registerUser(baseUrl());
    await createReport(r1.cookie, { targetType: "pamphlet", targetId: pid, reason: "spam", details: "تبلیغ است" });
    await createReport(r2.cookie, { targetType: "pamphlet", targetId: pid, reason: "other", details: null });

    const admin = await adminCookie();
    const pending = await api<{ items: ReportItem[]; total: number }>(
      baseUrl(),
      "/api/v1/admin/reports",
      { cookie: admin }
    );
    expect(pending.status).toBe(200);
    expect(pending.data.items.every((x) => x.status === "PENDING")).toBe(true);
    expect(pending.data.items.length).toBeGreaterThanOrEqual(2);
    const one = pending.data.items.find((x) => x.targetId === pid)!;
    expect(one.targetSummary).toBe("جزوهٔ صف");
    expect(one.targetUrl).toBe(`#/pamphlet/${pid}`);
    expect(one.reporter.fullName).toBeTruthy();

    // resolve one → default filter shrinks, status=all still shows it
    const target = pending.data.items[0];
    const res = await api(baseUrl(), `/api/v1/admin/reports/${target.id}/resolve`, {
      method: "POST",
      cookie: admin,
      json: { action: "dismiss" },
    });
    expect(res.status).toBe(200);

    const after = await api<{ items: ReportItem[] }>(baseUrl(), "/api/v1/admin/reports", { cookie: admin });
    expect(after.data.items.some((x) => x.id === target.id)).toBe(false);
    const all = await api<{ items: ReportItem[] }>(baseUrl(), "/api/v1/admin/reports?status=all", {
      cookie: admin,
    });
    const dismissed = all.data.items.find((x) => x.id === target.id)!;
    expect(dismissed.status).toBe("DISMISSED");
    expect(dismissed.reviewedBy?.fullName).toBe("محمدرضا منتجبی");
    expect(dismissed.reviewedAt).toBeTruthy();
  });

  test("comment report summary shows body excerpt; deleted comment shows [حذف شده]", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const commenter = await registerUser(baseUrl());
    const c = await postComment(commenter.cookie, pid, "یک پیام طولانی برای پیش‌نمایش گزارش");
    const reporter = await registerUser(baseUrl());
    await createReport(reporter.cookie, { targetType: "comment", targetId: c.id, reason: "spam" });

    const admin = await adminCookie();
    const list = await api<{ items: ReportItem[] }>(baseUrl(), "/api/v1/admin/reports", { cookie: admin });
    const item = list.data.items.find((x) => x.targetId === c.id)!;
    expect(item.targetSummary).toContain("پیام طولانی");
    expect(item.targetUrl).toBe(`#/pamphlet/${pid}`);

    // delete the comment → summary becomes [حذف شده]
    const del = await api(baseUrl(), `/api/v1/comments/${c.id}`, { method: "DELETE", cookie: commenter.cookie });
    expect(del.status).toBe(200);
    const list2 = await api<{ items: ReportItem[] }>(baseUrl(), "/api/v1/admin/reports", { cookie: admin });
    expect(list2.data.items.find((x) => x.targetId === c.id)!.targetSummary).toBe("[حذف شده]");
  });

  test("pagination works", async () => {
    const admin = await adminCookie();
    const p1 = await api<{ items: ReportItem[]; page: number; pageSize: number }>(
      baseUrl(),
      "/api/v1/admin/reports?status=all&page=1&pageSize=2",
      { cookie: admin }
    );
    expect(p1.status).toBe(200);
    expect(p1.data.items.length).toBeLessThanOrEqual(2);
    expect(p1.data.pageSize).toBe(2);
  });
});

describe("POST /admin/reports/[id]/resolve (P20)", () => {
  test("non-admin → 403; already-resolved → 400", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const reporter = await registerUser(baseUrl());
    const rep = await createReport(reporter.cookie, { targetType: "pamphlet", targetId: pid, reason: "spam" });

    const stranger = await registerUser(baseUrl());
    const forbidden = await api(baseUrl(), `/api/v1/admin/reports/${rep.data.id}/resolve`, {
      method: "POST",
      cookie: stranger.cookie,
      json: { action: "dismiss" },
    });
    expect(forbidden.status).toBe(403);

    const admin = await adminCookie();
    const first = await api(baseUrl(), `/api/v1/admin/reports/${rep.data.id}/resolve`, {
      method: "POST", cookie: admin, json: { action: "action_taken" },
    });
    expect(first.status).toBe(200);
    const second = await api(baseUrl(), `/api/v1/admin/reports/${rep.data.id}/resolve`, {
      method: "POST", cookie: admin, json: { action: "dismiss" },
    });
    expect(second.status).toBe(400);
    expect((second.data as unknown as { error: string }).error).toBe("این گزارش قبلاً بررسی شده است");
  });
});

describe("PATCH /admin/pamphlets/[id]/hide (P20)", () => {
  test("non-admin → 403", async () => {
    const u = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/admin/pamphlets/nope/hide", {
      method: "PATCH", cookie: u.cookie, json: { hidden: true },
    });
    expect(r.status).toBe(403);
  });

  test("hide → detail 404 for strangers, author still sees it, list excludes it", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ پنهان‌شدنی" });
    const stranger = await registerUser(baseUrl());

    // visible before
    const before = await api(baseUrl(), `/api/v1/pamphlets/${pid}`, { cookie: stranger.cookie });
    expect(before.status).toBe(200);

    const admin = await adminCookie();
    const hide = await api(baseUrl(), `/api/v1/admin/pamphlets/${pid}/hide`, {
      method: "PATCH", cookie: admin, json: { hidden: true },
    });
    expect(hide.status).toBe(200);

    // stranger → 404, both detail and list
    const hidden = await api(baseUrl(), `/api/v1/pamphlets/${pid}`, { cookie: stranger.cookie });
    expect(hidden.status).toBe(404);
    const list = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/pamphlets?pageSize=48");
    expect(list.data.items.some((x) => x.id === pid)).toBe(false);

    // author still sees it
    const authorView = await api(baseUrl(), `/api/v1/pamphlets/${pid}`, { cookie: author.cookie });
    expect(authorView.status).toBe(200);

    // admin still sees it
    const adminView = await api(baseUrl(), `/api/v1/pamphlets/${pid}`, { cookie: admin });
    expect(adminView.status).toBe(200);

    // related strip excludes it (registered with a different subject to keep seed noise low)
    const related = await api<{ items: Array<{ id: string }> }>(baseUrl(), `/api/v1/pamphlets/${pid}/related`);
    expect(related.status).toBe(200);
    expect(related.data.items.some((x) => x.id === pid)).toBe(false);

    // unhide → visible again
    const unhide = await api(baseUrl(), `/api/v1/admin/pamphlets/${pid}/hide`, {
      method: "PATCH", cookie: admin, json: { hidden: false },
    });
    expect(unhide.status).toBe(200);
    const restored = await api(baseUrl(), `/api/v1/pamphlets/${pid}`, { cookie: stranger.cookie });
    expect(restored.status).toBe(200);
    const listAfter = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/pamphlets?pageSize=48");
    expect(listAfter.data.items.some((x) => x.id === pid)).toBe(true);
  });
});

describe("PATCH /admin/users/[id]/suspend (P20)", () => {
  test("non-admin → 403; suspend admin → 400", async () => {
    const u = await registerUser(baseUrl());
    const r = await api(baseUrl(), `/api/v1/admin/users/${u.user.id}/suspend`, {
      method: "PATCH", cookie: u.cookie, json: { suspended: true },
    });
    expect(r.status).toBe(403);

    const admin = await adminCookie();
    const me = await api<{ user: { id: string } }>(baseUrl(), "/api/v1/auth/me", { cookie: admin });
    const selfSuspend = await api(baseUrl(), `/api/v1/admin/users/${me.data.user.id}/suspend`, {
      method: "PATCH", cookie: admin, json: { suspended: true },
    });
    expect(selfSuspend.status).toBe(400);
    expect((selfSuspend.data as unknown as { error: string }).error).toBe("نمی‌توانید مدیر را معلق کنید");
  });

  test("suspend → login 403, existing session dies on next request, unsuspend restores", async () => {
    // fixed email so the login refusal can be exercised with real credentials
    const email = `suspend-${Date.now()}-${Math.random().toString(36).slice(2)}@montamooz.ir`;
    const victim = await registerUser(baseUrl(), { email });
    const admin = await adminCookie();

    const suspend = await api(baseUrl(), `/api/v1/admin/users/${victim.user.id}/suspend`, {
      method: "PATCH", cookie: admin, json: { suspended: true },
    });
    expect(suspend.status).toBe(200);

    // existing session dies on its very next request (getCurrentUser → null)
    const dead = await api(baseUrl(), "/api/v1/auth/me", { cookie: victim.cookie });
    expect(dead.status).toBe(401);

    // login refused with the Persian message (unique XFF — auth is rate-limited per IP)
    const loginRes = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.98.76.54" },
      body: JSON.stringify({ email, password: "test-password-1234" }),
    });
    expect(loginRes.status).toBe(403);
    const body = (await loginRes.json()) as { error: string };
    expect(body.error).toBe("حساب شما معلق شده است. با مدیر تماس بگیرید");

    // unsuspend → login works again
    const unsuspend = await api(baseUrl(), `/api/v1/admin/users/${victim.user.id}/suspend`, {
      method: "PATCH", cookie: admin, json: { suspended: false },
    });
    expect(unsuspend.status).toBe(200);
    const cookie = await loginAs(baseUrl(), email, "test-password-1234");
    expect(cookie).toContain("ma_session=");
  });
});

describe("GET /admin/dashboard (P20)", () => {
  test("non-admin → 403", async () => {
    const u = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/admin/dashboard", { cookie: u.cookie });
    expect(r.status).toBe(403);
  });

  test("admin → metrics shape + recent lists", async () => {
    const admin = await adminCookie();
    const r = await api<{
      metrics: Record<string, number>;
      recentReports: unknown[];
      recentSignups: Array<{ id: string; email: string }>;
    }>(baseUrl(), "/api/v1/admin/dashboard", { cookie: admin });
    expect(r.status).toBe(200);
    const m = r.data.metrics;
    expect(m.totalUsers).toBeGreaterThan(0);
    expect(m.totalPamphlets).toBeGreaterThan(0);
    expect(typeof m.pendingReports).toBe("number");
    expect(typeof m.newUsersLast7Days).toBe("number");
    expect(r.data.recentSignups.length).toBeGreaterThan(0);
    expect(r.data.recentSignups[0].email).toContain("@");
  });
});

describe("GET /admin/users — suspendedAt + commentCount (P20 extension)", () => {
  test("returns suspendedAt and commentCount per user", async () => {
    const admin = await adminCookie();
    const r = await api<{
      items: Array<{ id: string; suspendedAt: string | null; commentCount: number }>;
    }>(baseUrl(), "/api/v1/admin/users?pageSize=50", { cookie: admin });
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(0);
    for (const u of r.data.items) {
      expect(u.suspendedAt).toBeNull(); // nothing suspended in a fresh seed
      expect(typeof u.commentCount).toBe("number");
    }
  });
});
