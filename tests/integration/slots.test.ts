// Integration tests — teaching slots (create, validation, overlap, list, delete)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser, loginAs, DEMO_USERS } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

describe("Slots — POST /slots", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", json: { slots: [{ startAt: inMinutes(120), price: 100000 }] },
    });
    expect(r.status).toBe(401);
  });

  test("past startAt → 400 «زمان شروع باید دست‌کم یک ساعت بعد از اکنون باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(30), price: 100000 }] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("زمان شروع باید دست‌کم یک ساعت بعد از اکنون باشد");
  });

  test("invalid duration → 400 «مدت جلسه باید یکی از مقادیر ۳۰، ۴۵، ۶۰، ۹۰ یا ۱۲۰ دقیقه باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(120), durationMinutes: 50, price: 100000 }] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("مدت جلسه باید یکی از مقادیر ۳۰، ۴۵، ۶۰، ۹۰ یا ۱۲۰ دقیقه باشد");
  });

  test("invalid price → 400 «نرخ هر جلسه باید بین ۲۰,۰۰۰ تا ۲,۰۰۰,۰۰۰ تومان و مضرب ۵,۰۰۰ باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(120), price: 12345 }] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("نرخ هر جلسه باید بین ۲۰,۰۰۰ تا ۲,۰۰۰,۰۰۰ تومان و مضرب ۵,۰۰۰ باشد");
  });

  test("overlapping own slot → 400 «این زمان با اسلات دیگری شما هم‌پوشانی دارد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r1 = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(300), price: 100000 }] },
    });
    expect(r1.status).toBe(201);
    const r2 = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(310), price: 100000 }] },
    });
    expect(r2.status).toBe(400);
    expect(r2.data.error).toBe("این زمان با اسلات دیگری شما هم‌پوشانی دارد");
  });

  test("same time for a DIFFERENT teacher is fine (overlap is per-owner)", async () => {
    const a = await registerUser(baseUrl());
    const b = await registerUser(baseUrl());
    const at = inMinutes(330);
    const r1 = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie: a.cookie, json: { slots: [{ startAt: at, price: 50000 }] },
    });
    const r2 = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie: b.cookie, json: { slots: [{ startAt: at, price: 50000 }] },
    });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  test("empty batch → 400 «حداقل یک اسلات ارسال کنید»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [] },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("حداقل یک اسلات ارسال کنید");
  });

  test("valid batch → 201 {created: N}", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ created: number }>(baseUrl(), "/api/v1/slots", {
      method: "POST",
      cookie,
      json: { slots: [
        { startAt: inMinutes(400), price: 100000 },
        { startAt: inMinutes(500), durationMinutes: 90, price: 150000 },
      ] },
    });
    expect(r.status).toBe(201);
    expect(r.data.created).toBe(2);
  });
});

describe("Slots — GET /slots/mine + /teachers/[id]/slots", () => {
  test("mine returns only my future/BOOKED slots", async () => {
    const me = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie: me.cookie, json: { slots: [{ startAt: inMinutes(600), price: 100000 }] },
    });
    await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie: other.cookie, json: { slots: [{ startAt: inMinutes(600), price: 100000 }] },
    });
    const r = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/slots/mine", { cookie: me.cookie });
    expect(r.status).toBe(200);
    // both mine (one from the overlap test? no — fresh user) — exactly the 1 created here
    expect(r.data.items).toHaveLength(1);
  });

  test("unauthenticated /slots/mine → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots/mine");
    expect(r.status).toBe(401);
  });

  test("teacher public slots: OPEN future only; unknown user → 404 «کاربر پیدا نشد»", async () => {
    const teacher = await registerUser(baseUrl(), { fullName: "استاد عمومی" });
    await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie: teacher.cookie, json: { slots: [{ startAt: inMinutes(700), price: 80000 }] },
    });
    const r = await api<{ items: Array<{ id: string }> }>(
      baseUrl(), `/api/v1/teachers/${teacher.user.id}/slots`
    );
    expect(r.status).toBe(200);
    expect(r.data.items).toHaveLength(1);

    const nf = await api<{ error: string }>(baseUrl(), "/api/v1/teachers/nope/slots");
    expect(nf.status).toBe(404);
    expect(nf.data.error).toBe("کاربر پیدا نشد");
  });

  test("seeded founder exposes public slots", async () => {
    const cookie = await loginAs(baseUrl(), DEMO_USERS.founder.email);
    const me = await api<{ user: { id: string } }>(baseUrl(), "/api/v1/auth/me", { cookie });
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/teachers/${me.data.user.id}/slots`);
    expect(r.status).toBe(200);
  });
});

describe("Slots — DELETE /slots/[id]", () => {
  test("someone else's slot → 404 «اسلات پیدا نشد» (no enumeration leak)", async () => {
    const owner = await registerUser(baseUrl());
    const stranger = await registerUser(baseUrl());
    const [id] = await (async () => {
      const r = await api<{ created: number }>(baseUrl(), "/api/v1/slots", {
        method: "POST", cookie: owner.cookie, json: { slots: [{ startAt: inMinutes(800), price: 100000 }] },
      });
      expect(r.status).toBe(201);
      const mine = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/slots/mine", { cookie: owner.cookie });
      return [mine.data.items[mine.data.items.length - 1].id];
    })();
    const r = await api<{ error: string }>(baseUrl(), `/api/v1/slots/${id}`, { method: "DELETE", cookie: stranger.cookie });
    expect(r.status).toBe(404);
    expect(r.data.error).toBe("اسلات پیدا نشد");
  });

  test("valid delete of my OPEN future slot → 200 {ok:true}; gone from mine", async () => {
    const { cookie } = await registerUser(baseUrl());
    await api<{ error: string }>(baseUrl(), "/api/v1/slots", {
      method: "POST", cookie, json: { slots: [{ startAt: inMinutes(900), price: 100000 }] },
    });
    const mine = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/slots/mine", { cookie });
    const id = mine.data.items[mine.data.items.length - 1].id;
    const r = await api<{ ok: boolean }>(baseUrl(), `/api/v1/slots/${id}`, { method: "DELETE", cookie });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
    const after = await api<{ items: Array<{ id: string }> }>(baseUrl(), "/api/v1/slots/mine", { cookie });
    expect(after.data.items.some((s) => s.id === id)).toBe(false);
  });

  test("unauthenticated delete → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/slots/some-id", { method: "DELETE" });
    expect(r.status).toBe(401);
  });
});
