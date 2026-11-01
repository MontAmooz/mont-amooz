// Integration tests — forks + merge request lifecycle
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

async function makeForkPair(title: string) {
  void title;
  const author = await registerUser(baseUrl(), { fullName: "نویسندهٔ اصلی" });
  const forkAuthor = await registerUser(baseUrl(), { fullName: "فورک‌کننده" });
  const targetId = await createPamphlet(baseUrl(), author.cookie, { title });
  const forkRes = await api<{ id: string }>(baseUrl(), `/api/v1/pamphlets/${targetId}/fork`, {
    method: "POST",
    cookie: forkAuthor.cookie,
  });
  expect(forkRes.status).toBe(201);
  return { author, forkAuthor, targetId, forkId: forkRes.data.id };
}

describe("Fork — POST /pamphlets/[id]/fork", () => {
  test("unauthenticated → 401", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "فورک‌ناپذیر" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/fork`, { method: "POST" });
    expect(r.status).toBe(401);
  });

  test("own pamphlet → 403 «نمی‌توانید جزوهٔ خودتان را فورک کنید»", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ خودم" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/fork`, {
      method: "POST",
      cookie: author.cookie,
    });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("نمی‌توانید جزوهٔ خودتان را فورک کنید");
  });

  test("valid fork → 201, title suffixed «(فورک)», forkedFromId set", async () => {
    const { forkAuthor, targetId, forkId } = await makeForkPair("اصلیِ فورک‌شدنی");
    const detail = await api<{
      title: string; forkedFromId: string | null; isMine: boolean;
    }>(baseUrl(), `/api/v1/pamphlets/${forkId}`, { cookie: forkAuthor.cookie });
    expect(detail.status).toBe(200);
    expect(detail.data.title).toContain("(فورک)");
    expect(detail.data.forkedFromId).toBe(targetId);
    expect(detail.data.isMine).toBe(true);
  });

  test("unknown pamphlet → 404 «جزوه پیدا نشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets/nope/fork", { method: "POST", cookie });
    expect(r.status).toBe(404);
    expect(r.data.error).toBe("جزوه پیدا نشد");
  });
});

describe("Merge requests — POST /merge-requests", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      json: { sourceId: "a", targetId: "b", title: "عنوان پیشنهاد" },
    });
    expect(r.status).toBe(401);
  });

  test("missing ids → 400 «شناسهٔ جزوهٔ مبدأ و مقصد الزامی است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie,
      json: { title: "عنوان پیشنهاد" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("شناسهٔ جزوهٔ مبدأ و مقصد الزامی است");
  });

  test("non-fork source → 400 «پیشنهاد ادغام فقط از جزوهٔ فورک‌شده…»", async () => {
    const a = await registerUser(baseUrl());
    const b = await registerUser(baseUrl());
    const notFork = await createPamphlet(baseUrl(), a.cookie, { title: "جزوهٔ غیر فورک" });
    const target = await createPamphlet(baseUrl(), b.cookie, { title: "جزوهٔ مقصد" });
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: a.cookie,
      json: { sourceId: notFork, targetId: target, title: "عنوان پیشنهاد معتبر" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("پیشنهاد ادغام فقط از جزوهٔ فورک‌شده به جزوهٔ اصلی امکان‌پذیر است");
  });

  test("non-fork-author → 403 «فقط نویسندهٔ جزوهٔ فورک‌شده…»", async () => {
    const { author, targetId, forkId } = await makeForkPair("فورکِ دیگری");
    const stranger = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: stranger.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان پیشنهاد غریبه" },
    });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("فقط نویسندهٔ جزوهٔ فورک‌شده می‌تواند پیشنهاد ادغام ثبت کند");
  });

  test("valid MR → 201 {id}; duplicate OPEN → 409", async () => {
    const { forkAuthor, targetId, forkId } = await makeForkPair("فورکِ پیشنهادی");
    const r1 = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان پیشنهاد ادغام" },
    });
    expect(r1.status).toBe(201);
    expect(r1.data.id).toBeTruthy();

    const r2 = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان پیشنهاد تکراری" },
    });
    expect(r2.status).toBe(409);
    expect(r2.data.error).toBe("یک پیشنهاد ادغام باز برای این دو جزوه وجود دارد");
  });

  test("short title → 400 «عنوان پیشنهاد باید بین ۵ تا ۱۴۰ نویسه باشد»", async () => {
    const { forkAuthor, targetId, forkId } = await makeForkPair("فورکِ عنوان‌کوتاه");
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "اب" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("عنوان پیشنهاد باید بین ۵ تا ۱۴۰ نویسه باشد");
  });
});

describe("Merge requests — GET list + detail", () => {
  test("filter by targetId + status=OPEN", async () => {
    const { forkAuthor, targetId, forkId } = await makeForkPair("فورکِ فهرست‌شدنی");
    await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان فهرست فورک" },
    });
    const r = await api<{ items: Array<{ target: { id: string }; status: string; id: string }> }>(
      baseUrl(), `/api/v1/merge-requests?targetId=${targetId}&status=OPEN`
    );
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThanOrEqual(1);
    for (const it of r.data.items) {
      expect(it.target.id).toBe(targetId);
      expect(it.status).toBe("OPEN");
    }
  });

  test("detail returns diff + review permissions", async () => {
    const { author, forkAuthor, targetId, forkId } = await makeForkPair("فورکِ تفصیلی");
    // change the fork's content so the diff is non-empty
    await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${forkId}/versions`, {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { content: "محتوای کاملاً جدید برای تفاضل گرفتن در آزمون — بیش از سی نویسه.", changeSummary: "ویرایش فورک" },
    });
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان تفصیلی" },
    });
    const asAuthor = await api<{ diff: unknown; canReview: boolean }>(
      baseUrl(), `/api/v1/merge-requests/${mr.data.id}`, { cookie: author.cookie }
    );
    expect(asAuthor.status).toBe(200);
    expect(asAuthor.data.canReview).toBe(true);

    const asStranger = await api<{ canReview: boolean }>(
      baseUrl(), `/api/v1/merge-requests/${mr.data.id}`, { cookie: forkAuthor.cookie }
    );
    expect(asStranger.data.canReview).toBe(false);
  });

  test("unknown MR → 404 «پیشنهاد ادغام پیدا نشد»", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests/nope");
    expect(r.status).toBe(404);
  });
});

describe("Merge requests — POST /[id]/review", () => {
  test("reject by target author → REJECTED", async () => {
    const { author, forkAuthor, targetId, forkId } = await makeForkPair("فورکِ ردشدنی");
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان ردشدنی" },
    });
    const r = await api<{ status: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: author.cookie,
      json: { action: "reject" },
    });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("REJECTED");
  });

  test("approve by target author → MERGED + target gets a new version + contributions", async () => {
    const { author, forkAuthor, targetId, forkId } = await makeForkPair("فورکِ ادغام‌شدنی");
    await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${forkId}/versions`, {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { content: "محتوای بهبودیافتهٔ فورک برای ادغام در اصلی — بیش از سی نویسه.", changeSummary: "بهبود" },
    });
    const before = await api<{ latestVersionNumber: number }>(
      baseUrl(), `/api/v1/pamphlets/${targetId}`, { cookie: author.cookie }
    );
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان ادغام‌شدنی" },
    });
    const r = await api<{ status: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: author.cookie,
      json: { action: "approve" },
    });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("MERGED");

    const after = await api<{
      latestVersionNumber: number; contributors: Array<{ fullName: string }>;
    }>(baseUrl(), `/api/v1/pamphlets/${targetId}`, { cookie: author.cookie });
    expect(after.data.latestVersionNumber).toBe(before.data.latestVersionNumber + 1);
    expect(after.data.contributors.some((c) => c.fullName === "فورک‌کننده")).toBe(true);
  });

  test("non-owner reviewer → 403 «فقط نویسندهٔ جزوهٔ اصلی می‌تواند تصمیم بگیرد»", async () => {
    const { forkAuthor, targetId, forkId } = await makeForkPair("فورکِ غیرمجاز");
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان غیرمجاز" },
    });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { action: "approve" },
    });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("فقط نویسندهٔ جزوهٔ اصلی می‌تواند تصمیم بگیرد");
  });

  test("invalid action → 400 «عملیات باید «approve» یا «reject» باشد»", async () => {
    const { author, forkAuthor, targetId, forkId } = await makeForkPair("فورکِ بی‌عملیات");
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان بی‌عملیات" },
    });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: author.cookie,
      json: { action: "maybe" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("عملیات باید «approve» یا «reject» باشد");
  });

  test("second review after decision → 400 «این پیشنهاد ادغام قبلاً بررسی شده است»", async () => {
    const { author, forkAuthor, targetId, forkId } = await makeForkPair("فورکِ داوری‌شده");
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkAuthor.cookie,
      json: { sourceId: forkId, targetId, title: "عنوان داوری‌شده" },
    });
    await api<{ error: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST", cookie: author.cookie, json: { action: "reject" },
    });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST", cookie: author.cookie, json: { action: "approve" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("این پیشنهاد ادغام قبلاً بررسی شده است");
  });

  test("unauthenticated review → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/merge-requests/some-id/review", {
      method: "POST", json: { action: "approve" },
    });
    expect(r.status).toBe(401);
  });
});
