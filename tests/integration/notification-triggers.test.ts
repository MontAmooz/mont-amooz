// Integration tests — notification triggers (P11)
// Each trigger fires AFTER its main action commits; self-notifications are
// skipped by notify(). Recipients are read back through GET /notifications.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createCourse, createPamphlet, createSlots, DEMO_USERS, ensureWalletBalance, loginAs, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  relatedType: string | null;
  readAt: string | null;
};

async function notifications(cookie: string): Promise<Item[]> {
  const r = await api<{ items: Item[] }>(baseUrl(), "/api/v1/notifications?pageSize=50", { cookie });
  expect(r.status).toBe(200);
  return r.data.items;
}

/** Fork a pamphlet as the given session → the fork's id. */
async function fork(cookie: string, sourceId: string): Promise<string> {
  const r = await api<{ id: string }>(baseUrl(), `/api/v1/pamphlets/${sourceId}/fork`, {
    method: "POST",
    cookie,
  });
  expect(r.status).toBe(201);
  return r.data.id;
}

describe("MR triggers", () => {
  test("MR created → target owner gets MR_RECEIVED; creator gets none", async () => {
    const owner = await registerUser(baseUrl());
    const forkUser = await registerUser(baseUrl());
    const targetId = await createPamphlet(baseUrl(), owner.cookie, { title: "جزوهٔ مبدأ MR" });
    const forkId = await fork(forkUser.cookie, targetId);

    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkUser.cookie,
      json: { sourceId: forkId, targetId, title: "بهبود فصل دوم برای تست" },
    });
    expect(mr.status).toBe(201);

    const ownerNotes = await notifications(owner.cookie);
    const received = ownerNotes.find((n) => n.type === "MR_RECEIVED");
    expect(received).toBeTruthy();
    expect(received!.body).toContain("پیشنهاد ادغام فرستاد");
    expect(received!.linkUrl).toBe(`#/request/${mr.data.id}`);
    expect(received!.readAt).toBeNull();

    const forkNotes = await notifications(forkUser.cookie);
    expect(forkNotes.find((n) => n.type === "MR_RECEIVED")).toBeUndefined();
  });

  test("MR approved → creator gets MR_REVIEWED with «تأیید شد»", async () => {
    const owner = await registerUser(baseUrl());
    const forkUser = await registerUser(baseUrl());
    const targetId = await createPamphlet(baseUrl(), owner.cookie, { title: "جزوهٔ ادغام‌شدنی" });
    const forkId = await fork(forkUser.cookie, targetId);
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkUser.cookie,
      json: { sourceId: forkId, targetId, title: "افزودن تمرین‌های کنکوری" },
    });

    const approve = await api(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: owner.cookie,
      json: { action: "approve" },
    });
    expect(approve.status).toBe(200);

    const notes = await notifications(forkUser.cookie);
    const reviewed = notes.find((n) => n.type === "MR_REVIEWED");
    expect(reviewed).toBeTruthy();
    expect(reviewed!.title).toContain("تأیید شد");
  });

  test("MR rejected → creator gets MR_REVIEWED with «رد شد»", async () => {
    const owner = await registerUser(baseUrl());
    const forkUser = await registerUser(baseUrl());
    const targetId = await createPamphlet(baseUrl(), owner.cookie, { title: "جزوهٔ ردشدنی" });
    const forkId = await fork(forkUser.cookie, targetId);
    const mr = await api<{ id: string }>(baseUrl(), "/api/v1/merge-requests", {
      method: "POST",
      cookie: forkUser.cookie,
      json: { sourceId: forkId, targetId, title: "تغییری که رد می‌شود" },
    });

    const reject = await api(baseUrl(), `/api/v1/merge-requests/${mr.data.id}/review`, {
      method: "POST",
      cookie: owner.cookie,
      json: { action: "reject" },
    });
    expect(reject.status).toBe(200);

    const notes = await notifications(forkUser.cookie);
    const reviewed = notes.find((n) => n.type === "MR_REVIEWED");
    expect(reviewed).toBeTruthy();
    expect(reviewed!.title).toContain("رد شد");
  });

  test("self-review (author reviews own pamphlet) → no notification", async () => {
    // forking your own pamphlet is 403, so the constructible self-notification
    // path is a self-review — notify() must skip it (actor === recipient)
    const owner = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), owner.cookie, { title: "جزوهٔ خودبازخورد" });

    const r = await api(baseUrl(), `/api/v1/pamphlets/${pamphletId}/reviews`, {
      method: "POST",
      cookie: owner.cookie,
      json: { rating: 5, comment: "به جزوهٔ خودم امتیاز می‌دهم" },
    });
    expect(r.status).toBe(200);

    const notes = await notifications(owner.cookie);
    expect(notes.find((n) => n.type === "REVIEW_RECEIVED")).toBeUndefined();
  });
});

describe("Review trigger", () => {
  test("first review notifies the owner; editing it does not duplicate", async () => {
    const owner = await registerUser(baseUrl());
    const reviewer = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), owner.cookie, { title: "جزوهٔ بازخوردپذیر" });

    const post = async (rating: number, comment: string) =>
      api(baseUrl(), `/api/v1/pamphlets/${pamphletId}/reviews`, {
        method: "POST",
        cookie: reviewer.cookie,
        json: { rating, comment },
      });
    expect((await post(4, "نظر اول")).status).toBe(200);
    expect((await post(5, "نظر ویرایش‌شده")).status).toBe(200);

    const notes = await notifications(owner.cookie);
    const reviews = notes.filter((n) => n.type === "REVIEW_RECEIVED");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].body).toContain("امتیاز داد");
  });
});

describe("Session triggers", () => {
  test("booking notifies the teacher; completion notifies the student", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const [slotId] = await createSlots(baseUrl(), teacher.cookie, [{}]);
    await ensureWalletBalance(baseUrl(), student.cookie, 100000);

    const booking = await api<{ id: string }>(baseUrl(), "/api/v1/sessions", {
      method: "POST",
      cookie: student.cookie,
      json: { slotId, topic: "جلسهٔ اعلان‌دار" },
    });
    expect(booking.status).toBe(201);
    const sessionId = booking.data.id;

    const teacherNotes = await notifications(teacher.cookie);
    const booked = teacherNotes.find((n) => n.type === "SESSION_BOOKED");
    expect(booked).toBeTruthy();
    expect(booked!.body).toContain("جلسهٔ اعلان‌دار");
    expect(booked!.linkUrl).toBe(`#/session/${sessionId}`);

    const complete = await api(baseUrl(), `/api/v1/sessions/${sessionId}/complete`, {
      method: "POST",
      cookie: teacher.cookie,
    });
    expect(complete.status).toBe(200);

    const studentNotes = await notifications(student.cookie);
    const completed = studentNotes.find((n) => n.type === "SESSION_COMPLETED");
    expect(completed).toBeTruthy();
    expect(completed!.body).toContain("بازخورد");
  });
});

describe("Course purchase trigger", () => {
  test("paid purchase notifies the teacher; free enrollment does not", async () => {
    const teacher = await registerUser(baseUrl());
    const student = await registerUser(baseUrl());
    const paid = await createCourse(baseUrl(), teacher.cookie, { price: 100000 });
    const free = await createCourse(baseUrl(), teacher.cookie, { price: 0 });
    await ensureWalletBalance(baseUrl(), student.cookie, 200000);

    const buyPaid = await api(baseUrl(), `/api/v1/courses/${paid.id}/purchase`, {
      method: "POST",
      cookie: student.cookie,
    });
    expect(buyPaid.status).toBe(201);

    const buyFree = await api(baseUrl(), `/api/v1/courses/${free.id}/purchase`, {
      method: "POST",
      cookie: student.cookie,
    });
    expect(buyFree.status).toBe(201);

    const notes = await notifications(teacher.cookie);
    const purchases = notes.filter((n) => n.type === "COURSE_PURCHASED");
    expect(purchases).toHaveLength(1); // free enrollment stays silent
    expect(purchases[0].body).toContain("خرید");
    expect(purchases[0].linkUrl).toBe(`#/course/${paid.id}`);
  });
});

// ===================== P16 — admin notified on registration =====================

describe("P16 — NEW_USER_REGISTERED", () => {
  test("registration → every admin gets a notification with the new user's name", async () => {
    const admin = await loginAs(baseUrl(), DEMO_USERS.founder.email, DEMO_USERS.founder.password);
    const uniqueName = `معلم تازه ${Date.now()}`;
    const { user } = await registerUser(baseUrl(), { fullName: uniqueName });

    const notes = await notifications(admin);
    const registered = notes.find((n) => n.type === "NEW_USER_REGISTERED");
    expect(registered).toBeTruthy();
    expect(registered!.body).toContain(uniqueName);
    expect(registered!.body).toContain("معلم"); // the role
    expect(registered!.linkUrl).toBe("#/admin");
    expect(registered!.relatedType).toBe("user");
    expect(registered!.readAt).toBeNull();

  });
});
