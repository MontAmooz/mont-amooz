// Integration tests — class sessions: booking, refunds, completion, review, join ticket
// Time-sensitive rules (SESSION_CANCEL_FULL_REFUND_HOURS = 2) use relative times.
import { describe, test, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { api, registerUser, ensureWalletBalance, createSlots, loginAs, DEMO_USERS } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
// collision-free slot offsets: every booking lands ≥12h from the previous one
// (the overlap check uses ±15min tolerance; the 90-min cancel test is the one
// deliberate exception, and it sits alone between the 60min lead and the 2h rule)
let slotOffset = 720;
const nextOffset = () => (slotOffset += 720);

let teacher: { cookie: string; user: { id: string } };
let student: { cookie: string; user: { id: string } };

beforeAll(async () => {
  teacher = await registerUser(baseUrl(), { fullName: "استاد جلسات" });
  student = await registerUser(baseUrl(), { fullName: "شاگرد جلسات" });
});

/** Book a fresh slot for the student; returns {sessionId, slotId, price}. */
async function book(startInMinutes = nextOffset(), price = 100000) {
  await ensureWalletBalance(baseUrl(), student.cookie, price);
  const [slotId] = await createSlots(baseUrl(), teacher.cookie, [{ startAt: inMinutes(startInMinutes), price }]);
  const r = await api<{ id: string }>(baseUrl(), "/api/v1/sessions", {
    method: "POST", cookie: student.cookie, json: { slotId, topic: "جلسهٔ تست" },
  });
  expect(r.status).toBe(201);
  return { sessionId: r.data.id, slotId, price };
}

describe("Sessions — POST /sessions (booking)", () => {
  test("unauthenticated → 401", async () => {
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [{ startAt: inMinutes(nextOffset()) }]);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST", json: { slotId },
    });
    expect(r.status).toBe(401);
  });

  test("missing slotId → 400 «اسلات مورد نظر الزامی است»", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST", cookie: student.cookie, json: {},
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("اسلات مورد نظر الزامی است");
  });

  test("own slot → 400 «نمی‌توانید اسلات خودتان را رزرو کنید»", async () => {
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [{ startAt: inMinutes(nextOffset()) }]);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST", cookie: teacher.cookie, json: { slotId },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("نمی‌توانید اسلات خودتان را رزرو کنید");
  });

  test("insufficient balance → 402 «موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید»", async () => {
    const poor = await registerUser(baseUrl(), { fullName: "بی‌پول" });
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [{ startAt: inMinutes(nextOffset()), price: 100000 }]);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST", cookie: poor.cookie, json: { slotId },
    });
    expect(r.status).toBe(402);
    expect(r.data.error).toBe("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید");
  });

  test("valid booking → 201 {id}; slot becomes BOOKED; student debited", async () => {
    await ensureWalletBalance(baseUrl(), student.cookie, 100000);
    const before = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    const { sessionId, slotId, price } = await book(100000);
    expect(sessionId).toBeTruthy();
    const teacherSlots = await api<{ items: Array<{ id: string; status: string }> }>(
      baseUrl(), "/api/v1/slots/mine", { cookie: teacher.cookie }
    );
    expect(teacherSlots.data.items.find((s) => s.id === slotId)?.status).toBe("BOOKED");
    const after = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    expect(after.data.balance).toBe(before.data.balance - price);
  });

  test("booking the same slot again → 409 «این اسلات همین حالا رزرو شد»", async () => {
    const { slotId } = await book();
    const second = await registerUser(baseUrl(), { fullName: "شاگرد دوم" });
    await ensureWalletBalance(baseUrl(), second.cookie, 200000);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST", cookie: second.cookie, json: { slotId },
    });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe("این اسلات همین حالا رزرو شد");
  });
});

describe("Sessions — GET list + detail", () => {
  test("role filter: student sees own bookings as student", async () => {
    const r = await api<{ items: Array<{ role: string }> }>(
      baseUrl(), "/api/v1/sessions?role=student", { cookie: student.cookie }
    );
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test("detail: member ok, stranger 403 «فقط شرکت‌کنندگان این جلسه دسترسی دارند»", async () => {
    const { sessionId } = await book();
    const okR = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}`, { cookie: student.cookie });
    expect(okR.status).toBe(200);
    const stranger = await registerUser(baseUrl());
    const noR = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}`, { cookie: stranger.cookie });
    expect(noR.status).toBe(403);
    expect(noR.data.error).toBe("فقط شرکت‌کنندگان این جلسه دسترسی دارند");
  });
});

describe("Sessions — cancel refunds (2h rule)", () => {
  test("student cancels ≥2h ahead → full refund", async () => {
    const { sessionId, price } = await book(nextOffset(), 120000);
    const before = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: student.cookie });
    expect(r.status).toBe(200);
    const after = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    expect(after.data.balance).toBe(before.data.balance + price);
  });

  test("student cancels <2h ahead → 50% refund to student, 50% to teacher", async () => {
    // 90 minutes ahead (slot creation needs ≥60min lead)
    const { sessionId, price } = await book(90, 100000);
    const sBefore = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    const tBefore = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: teacher.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: student.cookie });
    expect(r.status).toBe(200);
    const sAfter = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    const tAfter = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: teacher.cookie });
    expect(sAfter.data.balance).toBe(sBefore.data.balance + price / 2);
    expect(tAfter.data.balance).toBe(tBefore.data.balance + price / 2);
  });

  test("teacher cancel → full refund to student + CANCELLED_TEACHER", async () => {
    const { sessionId, price } = await book();
    const sBefore = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: teacher.cookie });
    expect(r.status).toBe(200);
    const sAfter = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: student.cookie });
    expect(sAfter.data.balance).toBe(sBefore.data.balance + price);
    const detail = await api<{ status: string }>(baseUrl(), `/api/v1/sessions/${sessionId}`, { cookie: student.cookie });
    expect(detail.data.status).toBe("CANCELLED_TEACHER");
  });

  test("cancel twice → 400 «این جلسه قابل لغو نیست»", async () => {
    const { sessionId } = await book();
    await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: student.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: student.cookie });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("این جلسه قابل لغو نیست");
  });

  test("stranger cancel → 403 «فقط شرکت‌کنندگان این جلسه دسترسی دارند»", async () => {
    const { sessionId } = await book();
    const stranger = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/cancel`, { method: "POST", cookie: stranger.cookie });
    expect(r.status).toBe(403);
  });
});

describe("Sessions — complete + review + join", () => {
  test("complete: non-teacher 403 «فقط معلم می‌تواند جلسه را پایان دهد»", async () => {
    const { sessionId } = await book();
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/complete`, { method: "POST", cookie: student.cookie });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("فقط معلم می‌تواند جلسه را پایان دهد");
  });

  test("teacher completes → COMPLETED + 80% SESSION_EARNING; review then works", async () => {
    const price = 100000;
    const { sessionId } = await book(nextOffset(), price);
    const tBefore = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: teacher.cookie });
    const r = await api<{ status: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/complete`, {
      method: "POST", cookie: teacher.cookie,
    });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("COMPLETED");
    const tAfter = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie: teacher.cookie });
    expect(tAfter.data.balance).toBe(tBefore.data.balance + Math.floor(price * 0.8));

    // review before complete is impossible now; review after complete works
    const rv = await api<{ review: { rating: number } }>(baseUrl(), `/api/v1/sessions/${sessionId}/review`, {
      method: "POST", cookie: student.cookie, json: { rating: 5, comment: "جلسهٔ عالی" },
    });
    expect(rv.status).toBe(200);
    expect(rv.data.review.rating).toBe(5);
  });

  test("review by teacher (non-student) → 403 «فقط دانش‌آموز این جلسه می‌تواند امتیاز دهد»", async () => {
    const { sessionId } = await book();
    await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/complete`, { method: "POST", cookie: teacher.cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/review`, {
      method: "POST", cookie: teacher.cookie, json: { rating: 5, comment: "خودم رو امتیاز بدم؟" },
    });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("فقط دانش‌آموز این جلسه می‌تواند امتیاز دهد");
  });

  test("join: returns ticket + role; non-BOOKED → 400 «جلسه در دسترس نیست»; stranger → 403", async () => {
    const { sessionId } = await book();
    const j = await api<{ ticket: string; role: string }>(
      baseUrl(), `/api/v1/sessions/${sessionId}/join`, { cookie: student.cookie }
    );
    expect(j.status).toBe(200);
    expect(j.data.role).toBe("student");
    expect(typeof j.data.ticket).toBe("string");
    expect(j.data.ticket.split(".")).toHaveLength(2); // HMAC ticket shape

    const stranger = await registerUser(baseUrl());
    const noR = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/join`, { cookie: stranger.cookie });
    expect(noR.status).toBe(403);

    await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/complete`, { method: "POST", cookie: teacher.cookie });
    const done = await api<{ error: string }>(baseUrl(), `/api/v1/sessions/${sessionId}/join`, { cookie: student.cookie });
    expect(done.status).toBe(400);
    expect(done.data.error).toBe("جلسه در دسترس نیست");
  });

  test("seeded founder has session history (seeded data sanity)", async () => {
    const cookie = await loginAs(baseUrl(), DEMO_USERS.founder.email);
    const r = await api<{ items: unknown[]; total: number }>(baseUrl(), "/api/v1/sessions?role=teacher", { cookie });
    expect(r.status).toBe(200);
    expect(r.data.total).toBeGreaterThanOrEqual(1);
  });
});
