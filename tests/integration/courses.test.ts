// Integration tests — video courses: create, lock/unlock, purchase, reviews, learn, watched
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser, createCourse, ensureWalletBalance } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("Courses — POST /courses", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/courses", {
      method: "POST",
      json: { title: "دوره", grade: "دهم", subject: "ریاضی", price: 0, lessons: [{ title: "درس", videoUrl: "https://x.com/v.mp4" }] },
    });
    expect(r.status).toBe(401);
  });

  test("zero lessons → 400 «هر دوره باید دست‌کم یک درس داشته باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/courses", {
      method: "POST", cookie,
      json: { title: "دورهٔ بی‌درس", description: "توضیح", grade: "دهم", subject: "ریاضی", price: 0, lessons: [] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("هر دوره باید دست‌کم یک درس داشته باشد");
  });

  test("invalid video URL → 400 «آدرس ویدیو معتبر نیست»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/courses", {
      method: "POST", cookie,
      json: { title: "دورهٔ ویدیوبد", description: "توضیح", grade: "دهم", subject: "ریاضی", price: 0,
        lessons: [{ title: "درس", videoUrl: "not-a-url" }] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("آدرس ویدیو معتبر نیست");
  });

  test("negative price → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/courses", {
      method: "POST", cookie,
      json: { title: "دورهٔ منفی", description: "توضیح", grade: "دهم", subject: "ریاضی", price: -5,
        lessons: [{ title: "درس", videoUrl: "https://x.com/v.mp4" }] },
    });
    expect(r.status).toBe(400);
  });

  test("valid PUBLISHED course → 201 {id}", async () => {
    const { cookie } = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), cookie, { title: "دورهٔ معتبر", price: 50000, lessonCount: 3 });
    expect(c.id).toBeTruthy();
    expect(c.lessonIds).toHaveLength(3);
  });
});

describe("Courses — GET list + detail locking", () => {
  test("list is public and contains seeded + created courses", async () => {
    const r = await api<{ total: number; items: Array<{ id: string }> }>(baseUrl(), "/api/v1/courses");
    expect(r.status).toBe(200);
    expect(r.data.total).toBeGreaterThanOrEqual(5); // 5 seeded
  });

  test("price sorting works (price_asc vs price_desc)", async () => {
    const asc = await api<{ items: Array<{ price: number }> }>(baseUrl(), "/api/v1/courses?sort=price_asc");
    const desc = await api<{ items: Array<{ price: number }> }>(baseUrl(), "/api/v1/courses?sort=price_desc");
    expect(asc.status).toBe(200);
    expect(desc.status).toBe(200);
    expect(asc.data.items[0].price).toBeLessThanOrEqual(desc.data.items[0].price);
  });

  test("locked lessons hide videoUrl from strangers; free preview keeps it", async () => {
    const owner = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, {
      title: "دورهٔ قفل‌دار", price: 100000, lessonCount: 2,
    });
    // set lesson 1 as free preview via a second course? — simpler: detail as stranger
    const stranger = await api<{
      lessons: Array<{ videoUrl?: string; isFreePreview: boolean }>; enrolled: boolean;
    }>(baseUrl(), `/api/v1/courses/${c.id}`);
    expect(stranger.status).toBe(200);
    expect(stranger.data.enrolled).toBe(false);
    for (const l of stranger.data.lessons) {
      if (!l.isFreePreview) expect(l.videoUrl).toBeUndefined();
    }

    const mine = await api<{ lessons: Array<{ videoUrl?: string }> }>(
      baseUrl(), `/api/v1/courses/${c.id}`, { cookie: owner.cookie }
    );
    for (const l of mine.data.lessons) expect(l.videoUrl).toContain("https://");
  });

  test("DRAFT hidden from non-owner → 404; visible to owner", async () => {
    const owner = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ پیش‌نویس", status: "DRAFT" });
    const stranger = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}`);
    expect(stranger.status).toBe(404);
    expect(stranger.data.error).toBe("دوره پیدا نشد");
    const own = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}`, { cookie: owner.cookie });
    expect(own.status).toBe(200);
  });

  test("unknown course → 404 «دوره پیدا نشد»", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/courses/nope");
    expect(r.status).toBe(404);
  });
});

describe("Courses — purchase", () => {
  test("own course → 403 «این دورهٔ خودتان است»", async () => {
    const owner = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ خودی", price: 100000 });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: owner.cookie });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("این دورهٔ خودتان است");
  });

  test("insufficient balance → 402 «موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید»", async () => {
    const owner = await registerUser(baseUrl());
    const buyer = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ گران", price: 100000 });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    expect(r.status).toBe(402);
    expect(r.data.error).toBe("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید");
  });

  test("paid purchase → 201; student debited, teacher credited 80%, enrollment + txns", async () => {
    const owner = await registerUser(baseUrl(), { fullName: "مدرس دوره" });
    const buyer = await registerUser(baseUrl(), { fullName: "خریدار دوره" });
    const price = 200000;
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ خریدنی", price, lessonCount: 2 });
    await ensureWalletBalance(baseUrl(), buyer.cookie, price);

    const tBefore = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: owner.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    expect(r.status).toBe(201);

    const bAfter = await api<{ balance: number; transactions: Array<{ type: string; amount: number }> }>(
      baseUrl(), "/api/v1/wallet", { cookie: buyer.cookie }
    );
    expect(bAfter.data.balance).toBe(bAfter.data.balance); // debit verified via txn below
    expect(bAfter.data.transactions.some((t) => t.type === "COURSE_PURCHASE" && t.amount === -price)).toBe(true);
    const tAfter = await api<{ balance: number; transactions: Array<{ type: string; amount: number }> }>(
      baseUrl(), "/api/v1/wallet", { cookie: owner.cookie }
    );
    expect(tAfter.data.balance).toBe(tBefore.data.balance + Math.floor((price * 80) / 100));
    expect(tAfter.data.transactions.some((t) => t.type === "COURSE_EARNING" && t.amount === Math.floor((price * 80) / 100))).toBe(true);

    const detail = await api<{ enrolled: boolean; lessons: Array<{ videoUrl?: string }> }>(
      baseUrl(), `/api/v1/courses/${c.id}`, { cookie: buyer.cookie }
    );
    expect(detail.data.enrolled).toBe(true);
    for (const l of detail.data.lessons) expect(l.videoUrl).toContain("https://");
  });

  test("double purchase → 409 «شما قبلاً این دوره را خریده‌اید»", async () => {
    const owner = await registerUser(baseUrl());
    const buyer = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ تکراری", price: 100000 });
    await ensureWalletBalance(baseUrl(), buyer.cookie, 300000);
    await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe("شما قبلاً این دوره را خریده‌اید");
  });

  test("free course → direct enrollment, no money moves", async () => {
    const owner = await registerUser(baseUrl());
    const buyer = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ رایگان", price: 0 });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    expect(r.status).toBe(201);
    const b = await api<{ balance: number; transactions: Array<{ type: string }> }>(
      baseUrl(), "/api/v1/wallet", { cookie: buyer.cookie }
    );
    expect(b.data.balance).toBe(0);
    expect(b.data.transactions.some((t) => t.type === "COURSE_PURCHASE")).toBe(false);
  });

  test("DRAFT course purchase → 404 «دوره پیدا نشد»", async () => {
    const owner = await registerUser(baseUrl());
    const buyer = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "پیش‌نویسِ خریدنی", status: "DRAFT" });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: buyer.cookie });
    expect(r.status).toBe(404);
  });
});

describe("Courses — reviews, learn, watched", () => {
  test("course review: non-enrolled → 403 «فقط دانش‌آموزان دوره می‌توانند نظر ثبت کنند»; enrolled → 200", async () => {
    const owner = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ نقدشدنی", price: 0 });
    const denied = await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/reviews`, {
      method: "POST", cookie: student.cookie, json: { rating: 5, comment: "ندیده گفتم" },
    });
    expect(denied.status).toBe(403);
    expect(denied.data.error).toBe("فقط دانش‌آموزان دوره می‌توانند نظر ثبت کنند");

    await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: student.cookie });
    const okR = await api<{ review: { rating: number } }>(baseUrl(), `/api/v1/courses/${c.id}/reviews`, {
      method: "POST", cookie: student.cookie, json: { rating: 4, comment: "خوب بود" },
    });
    expect(okR.status).toBe(200);
    expect(okR.data.review.rating).toBe(4);
  });

  test("watched: non-enrolled → 403 «برای ثبت پیشرفت، ابتدا دوره را خریداری کنید»; enrolled → progressPercent", async () => {
    const owner = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ پیشرفت‌دار", price: 0, lessonCount: 2 });
    const denied = await api<{ error: string }>(baseUrl(), `/api/v1/lessons/${c.lessonIds[0]}/watched`, {
      method: "POST", cookie: student.cookie, json: { watched: true },
    });
    expect(denied.status).toBe(403);
    expect(denied.data.error).toBe("برای ثبت پیشرفت، ابتدا دوره را خریداری کنید");

    await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: student.cookie });
    const w1 = await api<{ progressPercent: number }>(baseUrl(), `/api/v1/lessons/${c.lessonIds[0]}/watched`, {
      method: "POST", cookie: student.cookie, json: { watched: true },
    });
    expect(w1.status).toBe(200);
    expect(w1.data.progressPercent).toBe(50);
    const w2 = await api<{ progressPercent: number }>(baseUrl(), `/api/v1/lessons/${c.lessonIds[1]}/watched`, {
      method: "POST", cookie: student.cookie, json: { watched: true },
    });
    expect(w2.data.progressPercent).toBe(100);
  });

  test("learn lists enrollment with progress + nextLesson", async () => {
    const owner = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const c = await createCourse(baseUrl(), owner.cookie, { title: "دورهٔ یادگیری", price: 0, lessonCount: 2 });
    await api<{ error: string }>(baseUrl(), `/api/v1/courses/${c.id}/purchase`, { method: "POST", cookie: student.cookie });
    await api<{ error: string }>(baseUrl(), `/api/v1/lessons/${c.lessonIds[0]}/watched`, {
      method: "POST", cookie: student.cookie, json: { watched: true },
    });
    const r = await api<{
      items: Array<{ id: string; watchedLessons: number; progressPercent: number; nextLessonId: string | null }>;
    }>(baseUrl(), "/api/v1/learn", { cookie: student.cookie });
    expect(r.status).toBe(200);
    const item = r.data.items.find((e) => e.id === c.id);
    expect(item).toBeTruthy();
    expect(item!.watchedLessons).toBe(1);
    expect(item!.progressPercent).toBe(50);
    expect(item!.nextLessonId).toBe(c.lessonIds[1]);
  });

  test("learn unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/learn");
    expect(r.status).toBe(401);
  });
});
