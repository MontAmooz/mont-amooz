// Integration tests — pamphlet Q&A threads (P19)
// GET/POST /pamphlets/[id]/comments + DELETE /comments/[id]:
// public read, auth'd create with validation, single-level replies,
// soft delete (author or admin), COMMENT_RECEIVED notifications.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser, DEMO_USERS, loginAs } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

type CommentItem = {
  id: string;
  body: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; fullName: string; title: string | null; isAdmin: boolean; isPamphletAuthor: boolean };
  isMine: boolean;
  replies: CommentItem[];
};

type ListResponse = { items: CommentItem[]; total: number };

type CreatedComment = { id: string; body: string; createdAt: string; parentId: string | null };

async function postComment(cookie: string, pamphletId: string, json: Record<string, unknown>) {
  return api<CreatedComment>(baseUrl(), `/api/v1/pamphlets/${pamphletId}/comments`, {
    method: "POST",
    cookie,
    json,
  });
}

describe("POST /pamphlets/[id]/comments (P19)", () => {
  test("unauthenticated → 401", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await postComment("", pid, { body: "یک پرسش تست" });
    expect(r.status).toBe(401);
  });

  test("empty body → 400 «متن پیام حداقل ۲ کاراکتر است»", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await postComment(asker.cookie, pid, { body: "   " });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("متن پیام حداقل ۲ کاراکتر است");
  });

  test("1-char body → 400", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await postComment(asker.cookie, pid, { body: "م" });
    expect(r.status).toBe(400);
  });

  test("body > 3000 chars → 400 «متن پیام حداکثر ۳۰۰۰ کاراکتر است»", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await postComment(asker.cookie, pid, { body: "الف".repeat(3001) });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("متن پیام حداکثر ۳۰۰۰ کاراکتر است");
  });

  test("valid top-level → 201, persisted, pamphlet author notified", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ پرسش" });

    const r = await postComment(asker.cookie, pid, { body: "این بخش را متوجه نشدم" });
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();
    expect(r.data.parentId).toBeNull();

    const list = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(list.status).toBe(200);
    expect(list.data.items).toHaveLength(1);
    expect(list.data.total).toBe(1);
    expect(list.data.items[0].body).toBe("این بخش را متوجه نشدم");
    expect(list.data.items[0].author.id).toBe(asker.user.id);
    expect(list.data.items[0].author.isPamphletAuthor).toBe(false);

    const notes = await api<{ items: Array<{ type: string; title: string; relatedId: string | null }> }>(
      baseUrl(),
      "/api/v1/notifications?pageSize=50",
      { cookie: author.cookie }
    );
    const hit = notes.data.items.find(
      (n) => n.type === "COMMENT_RECEIVED" && n.relatedId === pid
    );
    expect(hit).toBeTruthy();
    expect(hit!.title).toBe("پرسش جدید در جزوه‌تان");
  });

  test("valid reply → 201, parent author notified with «پاسخ جدید به پرسش شما»", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);

    const q = await postComment(asker.cookie, pid, { body: "سؤال اصلی من این است" });
    expect(q.status).toBe(201);

    const answerer = await registerUser(baseUrl());
    const rep = await postComment(answerer.cookie, pid, {
      body: "پاسخ: این‌طور حل می‌شود",
      parentId: q.data.id,
    });
    expect(rep.status).toBe(201);
    expect(rep.data.parentId).toBe(q.data.id);

    // asker (parent author) gets the notification
    const notes = await api<{ items: Array<{ type: string; title: string }> }>(
      baseUrl(),
      "/api/v1/notifications?pageSize=50",
      { cookie: asker.cookie }
    );
    const hit = notes.data.items.find((n) => n.type === "COMMENT_RECEIVED");
    expect(hit).toBeTruthy();
    expect(hit!.title).toBe("پاسخ جدید به پرسش شما");

    // no self-notification for the answerer
    const mine = await api<{ items: Array<{ type: string; title: string }> }>(
      baseUrl(),
      "/api/v1/notifications?pageSize=50",
      { cookie: answerer.cookie }
    );
    expect(mine.data.items.filter((n) => n.type === "COMMENT_RECEIVED")).toHaveLength(0);
  });

  test("reply-to-reply → 400 «فقط یک سطح پاسخ مجاز است»", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پرسش سطح یک" });
    const rep = await postComment(author.cookie, pid, { body: "پاسخ سطح یک", parentId: q.data.id });

    const r = await postComment(asker.cookie, pid, {
      body: "تلاش برای پاسخ به پاسخ",
      parentId: rep.data.id,
    });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("فقط یک سطح پاسخ مجاز است");
  });

  test("comment on nonexistent pamphlet → 404 «جزوه پیدا نشد»", async () => {
    const asker = await registerUser(baseUrl());
    const r = await postComment(asker.cookie, "no-such-pamphlet", { body: "پرسش بی‌جزوه" });
    expect(r.status).toBe(404);
    expect((r.data as unknown as { error: string }).error).toBe("جزوه پیدا نشد");
  });

  test("reply to a comment from a different pamphlet → 400", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pidA = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ الف" });
    const pidB = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ ب" });

    const q = await postComment(asker.cookie, pidA, { body: "پرسش روی جزوهٔ الف" });
    const r = await postComment(asker.cookie, pidB, { body: "پاسخ روی جزوهٔ ب", parentId: q.data.id });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("پیام والد به این جزوه تعلق ندارد");
  });

  test("reply to nonexistent parent → 404", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await postComment(author.cookie, pid, { body: "پاسخ به هیچ", parentId: "no-parent" });
    expect(r.status).toBe(404);
  });

  test("reply to a deleted parent → 400", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پرسشی که حذف می‌شود" });
    const del = await api(baseUrl(), `/api/v1/comments/${q.data.id}`, {
      method: "DELETE",
      cookie: asker.cookie,
    });
    expect(del.status).toBe(200);

    const r = await postComment(author.cookie, pid, { body: "پاسخ به حذف‌شده", parentId: q.data.id });
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("پیام والد حذف شده است");
  });
});

describe("GET /pamphlets/[id]/comments (P19)", () => {
  test("unauthenticated → 200 (public read)", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const r = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(r.status).toBe(200);
    expect(r.data.items).toEqual([]);
    expect(r.data.total).toBe(0);
  });

  test("nested structure: replies under their question, newest questions first", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);

    const q1 = await postComment(asker.cookie, pid, { body: "پرسش اول" });
    await postComment(author.cookie, pid, { body: "پاسخ اول", parentId: q1.data.id });
    await postComment(asker.cookie, pid, { body: "پرسش دوم" });

    const r = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(r.data.total).toBe(3); // 2 questions + 1 answer
    expect(r.data.items).toHaveLength(2);
    // newest top-level first
    expect(r.data.items[0].body).toBe("پرسش دوم");
    expect(r.data.items[0].replies).toHaveLength(0);
    expect(r.data.items[1].body).toBe("پرسش اول");
    expect(r.data.items[1].replies).toHaveLength(1);
    expect(r.data.items[1].replies[0].body).toBe("پاسخ اول");
    // replies never carry their own replies (single level)
    expect(r.data.items[1].replies[0].replies).toHaveLength(0);
  });

  test("isMine true for the author's own comments when authed; isPamphletAuthor flagged", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پرسش من" });
    await postComment(author.cookie, pid, { body: "پاسخ من", parentId: q.data.id });

    const r = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`, {
      cookie: asker.cookie,
    });
    const mine = r.data.items.find((c) => c.body === "پرسش من")!;
    expect(mine.isMine).toBe(true);
    expect(mine.author.isPamphletAuthor).toBe(false);
    const theirs = r.data.items.find((c) => c.replies.length > 0)!.replies[0];
    expect(theirs.isMine).toBe(false);
    expect(theirs.author.isPamphletAuthor).toBe(true);
  });

  test("isMine false everywhere when unauthenticated", async () => {
    const author = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    await postComment(author.cookie, pid, { body: "پیام نویسنده" });
    const r = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(r.data.items[0].isMine).toBe(false);
  });
});

describe("DELETE /comments/[id] (P19)", () => {
  async function seeded() {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پیام برای حذف" });
    return { author, asker, pid, commentId: q.data.id };
  }

  test("unauthenticated → 401", async () => {
    const { commentId } = await seeded();
    const r = await api(baseUrl(), `/api/v1/comments/${commentId}`, { method: "DELETE" });
    expect(r.status).toBe(401);
  });

  test("non-author → 403", async () => {
    const { pid, commentId } = await seeded();
    const stranger = await registerUser(baseUrl());
    const r = await api(baseUrl(), `/api/v1/comments/${commentId}`, {
      method: "DELETE",
      cookie: stranger.cookie,
    });
    expect(r.status).toBe(403);
    // list still shows the original body
    const list = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(list.data.items[0].body).toBe("پیام برای حذف");
  });

  test("author → 200, soft-deleted (body emptied, row kept, replies allowed? no — parent blocked)", async () => {
    const { asker, pid, commentId } = await seeded();
    const r = await api(baseUrl(), `/api/v1/comments/${commentId}`, {
      method: "DELETE",
      cookie: asker.cookie,
    });
    expect(r.status).toBe(200);

    const list = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(list.data.items).toHaveLength(1); // row kept
    expect(list.data.items[0].deleted).toBe(true);
    expect(list.data.items[0].body).toBe("");
  });

  test("admin (founder) can delete someone else's comment", async () => {
    const { pid, commentId } = await seeded();
    const cookie = await loginAs(baseUrl(), DEMO_USERS.founder.email, DEMO_USERS.founder.password);
    const r = await api(baseUrl(), `/api/v1/comments/${commentId}`, {
      method: "DELETE",
      cookie,
    });
    expect(r.status).toBe(200);
    const list = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(list.data.items[0].deleted).toBe(true);
  });

  test("double delete → idempotent 200", async () => {
    const { asker, commentId } = await seeded();
    const first = await api(baseUrl(), `/api/v1/comments/${commentId}`, {
      method: "DELETE",
      cookie: asker.cookie,
    });
    expect(first.status).toBe(200);
    const second = await api(baseUrl(), `/api/v1/comments/${commentId}`, {
      method: "DELETE",
      cookie: asker.cookie,
    });
    expect(second.status).toBe(200);
  });

  test("deleting a reply keeps it listed under its parent (placeholder)", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پرسش با پاسخ" });
    const rep = await postComment(author.cookie, pid, { body: "پاسخی که حذف می‌شود", parentId: q.data.id });
    const del = await api(baseUrl(), `/api/v1/comments/${rep.data.id}`, {
      method: "DELETE",
      cookie: author.cookie,
    });
    expect(del.status).toBe(200);

    const list = await api<ListResponse>(baseUrl(), `/api/v1/pamphlets/${pid}/comments`);
    expect(list.data.total).toBe(2);
    expect(list.data.items[0].replies[0].deleted).toBe(true);
    expect(list.data.items[0].replies[0].body).toBe("");
  });
});

describe("detail commentCount (P19)", () => {
  test("pamphlet detail reflects live non-deleted comment count", async () => {
    const author = await registerUser(baseUrl());
    const asker = await registerUser(baseUrl());
    const pid = await createPamphlet(baseUrl(), author.cookie);
    const q = await postComment(asker.cookie, pid, { body: "پرسش شمارنده" });
    await postComment(author.cookie, pid, { body: "پاسخ شمارنده", parentId: q.data.id });

    const before = await api<{ commentCount: number }>(baseUrl(), `/api/v1/pamphlets/${pid}`);
    expect(before.data.commentCount).toBe(2);

    await api(baseUrl(), `/api/v1/comments/${q.data.id}`, {
      method: "DELETE",
      cookie: asker.cookie,
    });
    const after = await api<{ commentCount: number }>(baseUrl(), `/api/v1/pamphlets/${pid}`);
    expect(after.data.commentCount).toBe(1); // soft-deleted excluded
  });
});
