// Integration tests — /api/v1/pamphlets (CRUD, versions, listing, search)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import {
  api,
  createPamphlet,
  loginAs,
  registerUser,
  DEMO_USERS,
} from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

const LONG_CONTENT = "این یک محتوای آزمایشی با طول کافی است — بیش از سی نویسه برای اعتبارسنجی.\n";

describe("Pamphlets — POST /pamphlets", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets", {
      method: "POST",
      json: { title: "تست", grade: "دهم", subject: "ریاضی", teachingMethod: "مفهومی", difficulty: "متوسط", content: LONG_CONTENT },
    });
    expect(r.status).toBe(401);
  });

  test("valid create → 201 + id", async () => {
    const { cookie } = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ معتبر برای ایجاد" });
    expect(id).toMatch(/^[a-z0-9]+$/i);
  });

  test("missing title → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets", {
      method: "POST",
      cookie,
      json: { grade: "دهم", subject: "ریاضی", teachingMethod: "مفهومی", difficulty: "متوسط", content: LONG_CONTENT },
    });
    expect(r.status).toBe(400);
  });

  test("short title → 400 «عنوان باید بین ۳ تا ۱۲۰ نویسه باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets", {
      method: "POST",
      cookie,
      json: { title: "اب", grade: "دهم", subject: "ریاضی", teachingMethod: "مفهومی", difficulty: "متوسط", content: LONG_CONTENT },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("عنوان باید بین ۳ تا ۱۲۰ نویسه باشد");
  });

  test("invalid grade → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets", {
      method: "POST",
      cookie,
      json: { title: "عنوان معتبر", grade: "سیزدهم", subject: "ریاضی", teachingMethod: "مفهومی", difficulty: "متوسط", content: LONG_CONTENT },
    });
    expect(r.status).toBe(400);
  });

  test("content under 30 chars → 400 «محتوای جزوه باید حداقل ۳۰ نویسه باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets", {
      method: "POST",
      cookie,
      json: { title: "عنوان معتبر", grade: "دهم", subject: "ریاضی", teachingMethod: "مفهومی", difficulty: "متوسط", content: "کوتاه" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("محتوای جزوه باید حداقل ۳۰ نویسه باشد");
  });
});

describe("Pamphlets — GET /pamphlets (list)", () => {
  test("public list shows at least the 14 seeded pamphlets", async () => {
    const r = await api<{ total: number }>(baseUrl(), "/api/v1/pamphlets");
    expect(r.status).toBe(200);
    expect(r.data.total).toBeGreaterThanOrEqual(14); // other files may add more (shared DB)
  });

  test("pagination: pageSize=2 page=2 differs from page=1", async () => {
    const p1 = await api<{ items: Array<{ id: string }>; total: number }>(
      baseUrl(), "/api/v1/pamphlets?page=1&pageSize=2"
    );
    const p2 = await api<{ items: Array<{ id: string }>; total: number }>(
      baseUrl(), "/api/v1/pamphlets?page=2&pageSize=2"
    );
    expect(p1.data.items).toHaveLength(2);
    expect(p2.data.items).toHaveLength(2);
    expect(p1.data.items[0].id).not.toBe(p2.data.items[0].id);
    expect(p1.data.total).toBeGreaterThanOrEqual(14);
    expect(p2.data.total).toBe(p1.data.total);
  });

  test("grade filter narrows results", async () => {
    const all = await api<{ total: number }>(baseUrl(), "/api/v1/pamphlets");
    const tenth = await api<{ total: number; items: Array<{ grade: string }> }>(
      baseUrl(), "/api/v1/pamphlets?grade=دهم"
    );
    expect(tenth.data.total).toBeLessThanOrEqual(all.data.total);
    expect(tenth.data.total).toBeGreaterThan(0);
    expect(tenth.data.total).toBeLessThan(all.data.total); // seed has multiple grades
    for (const it of tenth.data.items) expect(it.grade).toBe("دهم");
  });

  test("Persian-normalized search finds seeded content", async () => {
    const r = await api<{ total: number; items: Array<{ title: string }> }>(
      baseUrl(), "/api/v1/pamphlets?query=" + encodeURIComponent("مشتق")
    );
    expect(r.status).toBe(200);
    expect(r.data.total).toBeGreaterThan(0);
  });

  test("sorts return different orderings (newest vs popular)", async () => {
    const newest = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/pamphlets?sort=newest&pageSize=5");
    const popular = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/pamphlets?sort=popular&pageSize=5");
    expect(newest.status).toBe(200);
    expect(popular.status).toBe(200);
    expect(newest.data.items[0].id).not.toBe(popular.data.items[0].id);
  });
});

describe("Pamphlets — GET /pamphlets/[id]", () => {
  test("valid detail: content, versions, contributors, isMine", async () => {
    const { cookie } = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ جزئیات" });
    const r = await api<{
      id: string; content: string; latestVersionNumber: number; versions: unknown[];
      contributors: unknown[]; isMine: boolean; openMergeRequestCount: number;
    }>(baseUrl(), `/api/v1/pamphlets/${id}`, { cookie });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(id);
    expect(r.data.content).toContain("محتوا");
    expect(r.data.latestVersionNumber).toBe(1);
    expect(r.data.versions).toHaveLength(1);
    expect(r.data.isMine).toBe(true);
    expect(r.data.openMergeRequestCount).toBe(0);
  });

  test("unknown id → 404 «جزوه پیدا نشد»", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets/does-not-exist");
    expect(r.status).toBe(404);
    expect(r.data.error).toBe("جزوه پیدا نشد");
  });

  test("viewCount increments on repeated GETs", async () => {
    const { cookie } = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ بازدید" });
    await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}`);
    await new Promise((r) => setTimeout(r, 150)); // fire-and-forget counter
    const r2 = await api<{ viewCount: number }>(baseUrl(), `/api/v1/pamphlets/${id}`);
    expect(r2.data.viewCount).toBeGreaterThanOrEqual(1);
  });
});

describe("Pamphlets — POST /pamphlets/[id]/versions", () => {
  test("author publishes v2 → 201 {versionNumber: 2}", async () => {
    const { cookie } = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ نسخه‌دار" });
    const r = await api<{ versionNumber: number }>(baseUrl(), `/api/v1/pamphlets/${id}/versions`, {
      method: "POST",
      cookie,
      json: { content: LONG_CONTENT + "\nویرایش دوم.", changeSummary: "ویرایش دوم" },
    });
    expect(r.status).toBe(201);
    expect(r.data.versionNumber).toBe(2);
  });

  test("non-author → 403 «فقط نویسندهٔ جزوه می‌تواند نسخهٔ جدید منتشر کند»", async () => {
    const author = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ دیگران" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/versions`, {
      method: "POST",
      cookie: other.cookie,
      json: { content: LONG_CONTENT + "\nدستکاری نامهربان.", changeSummary: "نه" },
    });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("فقط نویسندهٔ جزوه می‌تواند نسخهٔ جدید منتشر کند");
  });

  test("unknown pamphlet → 404", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets/nope/versions", {
      method: "POST",
      cookie,
      json: { content: LONG_CONTENT, changeSummary: "x" },
    });
    expect(r.status).toBe(404);
  });

  test("short content → 400 «محتوای نسخه باید حداقل ۳۰ نویسه باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), cookie, { title: "جزوهٔ نسخهٔ کوتاه" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/versions`, {
      method: "POST",
      cookie,
      json: { content: "کم", changeSummary: "x" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("محتوای نسخه باید حداقل ۳۰ نویسه باشد");
  });
});

describe("Pamphlets — seeded data sanity", () => {
  test("founder's demo login works against seeded content", async () => {
    const cookie = await loginAs(baseUrl(), DEMO_USERS.founder.email);
    expect(cookie).toMatch(/^ma_session=/);
    const me = await api<{ user: { fullName: string } }>(baseUrl(), "/api/v1/auth/me", { cookie });
    expect(me.data.user.fullName).toBe("محمدرضا منتجبی");
  });
});
