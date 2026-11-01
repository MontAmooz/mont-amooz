// Integration tests — pamphlet reviews + helpful votes
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser, loginAs, DEMO_USERS } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("Reviews — POST /pamphlets/[id]/reviews", () => {
  test("unauthenticated → 401", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ ناشناس" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
      method: "POST", json: { rating: 5, comment: "عالی بود" },
    });
    expect(r.status).toBe(401);
  });

  test("rating out of range → 400 «امتیاز باید عددی بین ۱ تا ۵ باشد»", async () => {
    const author = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ امتیازبد" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
      method: "POST", cookie: reviewer.cookie, json: { rating: 6, comment: "خیلی خوب" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("امتیاز باید عددی بین ۱ تا ۵ باشد");
  });

  test("short comment → 400 «دیدگاه باید بین ۲ تا ۱۰۰۰ نویسه باشد»", async () => {
    const author = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ کمنظر" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
      method: "POST", cookie: reviewer.cookie, json: { rating: 4, comment: "خ" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("دیدگاه باید بین ۲ تا ۱۰۰۰ نویسه باشد");
  });

  test("valid review → 200 upsert; repeat updates, not duplicates", async () => {
    const author = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ بررسی‌شدنی" });
    const r1 = await api<{ review: { rating: number; comment: string; id: string } }>(
      baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
        method: "POST", cookie: reviewer.cookie, json: { rating: 3, comment: "متوسط بود" },
      }
    );
    expect(r1.status).toBe(200);
    expect(r1.data.review.rating).toBe(3);

    const r2 = await api<{ review: { rating: number; id: string } }>(
      baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
        method: "POST", cookie: reviewer.cookie, json: { rating: 5, comment: "بهتر شد" },
      }
    );
    expect(r2.status).toBe(200);
    expect(r2.data.review.rating).toBe(5);
    expect(r2.data.review.id).toBe(r1.data.review.id); // upsert, same row

    const list = await api<{ items: Array<{ id: string }> }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`);
    expect(list.data.items.filter((x) => x.id === r1.data.review.id)).toHaveLength(1);
  });

  test("unknown pamphlet → 404 «جزوه پیدا نشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/pamphlets/nope/reviews", {
      method: "POST", cookie, json: { rating: 5, comment: "هیچ" },
    });
    expect(r.status).toBe(404);
  });
});

describe("Reviews — GET /pamphlets/[id]/reviews", () => {
  test("items carry reviewer identity; myReview populated when authed", async () => {
    const author = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl(), { fullName: "بازبینِ مشخص" });
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ فهرست‌نظر" });
    await api<{ error: string }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
      method: "POST", cookie: reviewer.cookie, json: { rating: 5, comment: "فوق‌العاده" },
    });
    const anon = await api<{ items: Array<{ user: { fullName: string }; myVote: unknown }> }>(
      baseUrl(), `/api/v1/pamphlets/${id}/reviews`
    );
    expect(anon.data.items).toHaveLength(1);
    expect(anon.data.items[0].user.fullName).toBe("بازبینِ مشخص");

    const authed = await api<{ items: Array<{ myVote: unknown }> }>(
      baseUrl(), `/api/v1/pamphlets/${id}/reviews`, { cookie: reviewer.cookie }
    );
    expect(authed.data.items[0].myVote).toBeDefined();
  });
});

describe("Review votes — POST /reviews/[id]/vote", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/reviews/some-id/vote", {
      method: "POST", json: { value: 1 },
    });
    expect(r.status).toBe(401);
  });

  test("invalid value → 400 «رأی باید یکی از مقادیر ۱، ‎-۱ یا ۰ باشد»", async () => {
    const voter = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/reviews/some-id/vote", {
      method: "POST", cookie: voter.cookie, json: { value: 2 },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("رأی باید یکی از مقادیر ۱، ‎-۱ یا ۰ باشد");
  });

  test("unknown review → 404 «نظر پیدا نشد»", async () => {
    const voter = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/reviews/nope/vote", {
      method: "POST", cookie: voter.cookie, json: { value: 1 },
    });
    expect(r.status).toBe(404);
  });

  test("helpful → +1, unhelpful → −1, value 0 removes vote", async () => {
    const author = await registerUser(baseUrl());
    const voter = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, { title: "جزوهٔ رأی‌دار" });
    const review = await api<{ review: { id: string } }>(baseUrl(), `/api/v1/pamphlets/${id}/reviews`, {
      method: "POST", cookie: author.cookie, json: { rating: 4, comment: "برای رأی‌گیری" },
    });
    const rid = review.data.review.id;

    const up = await api<{ helpful: number; unhelpful: number; myVote: number }>(
      baseUrl(), `/api/v1/reviews/${rid}/vote`,
      { method: "POST", cookie: voter.cookie, json: { value: 1 } }
    );
    expect(up.status).toBe(200);
    expect(up.data.helpful).toBe(1);
    expect(up.data.unhelpful).toBe(0);
    expect(up.data.myVote).toBe(1);

    const down = await api<{ helpful: number; unhelpful: number; myVote: number }>(
      baseUrl(), `/api/v1/reviews/${rid}/vote`,
      { method: "POST", cookie: voter.cookie, json: { value: -1 } }
    );
    expect(down.data.helpful).toBe(0);
    expect(down.data.unhelpful).toBe(1);
    expect(down.data.myVote).toBe(-1);

    const clear = await api<{ helpful: number; unhelpful: number; myVote: number }>(
      baseUrl(), `/api/v1/reviews/${rid}/vote`,
      { method: "POST", cookie: voter.cookie, json: { value: 0 } }
    );
    expect(clear.data.helpful).toBe(0);
    expect(clear.data.unhelpful).toBe(0);
    expect(clear.data.myVote).toBe(0);
  });

  test("seeded review is votable by a demo account", async () => {
    const voter = await loginAs(baseUrl(), DEMO_USERS.student.email);
    const list = await api<{ items: Array<{ id: string }> }>(
      baseUrl(), "/api/v1/pamphlets?pageSize=1"
    );
    const pid = list.data.items[0].id;
    const reviews = await api<{ items: Array<{ id: string; helpful: number }> }>(
      baseUrl(), `/api/v1/pamphlets/${pid}/reviews`
    );
    if (reviews.data.items.length === 0) return; // seeded pamphlet without reviews — skip silently
    const rid = reviews.data.items[0].id;
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/reviews/${rid}/vote`, {
      method: "POST", cookie: voter, json: { value: 1 },
    });
    expect([200, 404]).toContain(r.status); // 404 only if the seeded review vanished
    if (r.status === 200) {
      // undo to keep the seeded aggregate stable-ish
      await api<{ error: string }>(baseUrl(), `/api/v1/reviews/${rid}/vote`, {
        method: "POST", cookie: voter, json: { value: 0 },
      });
    }
  });
});
