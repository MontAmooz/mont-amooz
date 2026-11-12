// P8 — classroom: two contexts join, chat relay, whiteboard stroke sync
// (3 scenarios). Runs against the REAL classroom-service through the test
// gateway (contract value XTransformPort=3003 → :3005). The seeded BOOKED
// session (mohammad ↔ hossein, tomorrow 19:00) is the room.
//
// The canvas draws via pointer events; headless Chromium delivers them but
// Playwright's websocket frametap misses socket.io v4 payload frames on this
// build, so stroke sync is asserted the way a user sees it: the student's
// board state — the app appends received strokes into `classroom.strokes`
// and renders them into ITS canvas; we snapshot pixel data before/after via
// canvas.toDataURL through evaluate (canvas is same-origin, no taint).
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

let bookedSessionId: string | null = null;

async function resolveBookedSession(request: APIRequestContext): Promise<string> {
  if (bookedSessionId) return bookedSessionId;
  const cookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const res = await request.get("/api/v1/sessions?role=student&pageSize=50", {
    headers: { cookie },
  });
  const body = (await res.json()) as { items?: Array<{ id: string; status: string }> };
  const booked = (body.items ?? []).find((s) => s.status === "BOOKED");
  if (!booked) throw new Error("no BOOKED session in seed");
  bookedSessionId = booked.id;
  return booked.id;
}

async function openRoom(page: Page, sessionId: string) {
  const joined = page.waitForResponse(
    (r) => r.url().includes(`/api/v1/sessions/${sessionId}/join`),
    { timeout: 20000 }
  );
  await page.goto(`#/session/${sessionId}`);
  await joined;
  await expect(page.getByText("متصل", { exact: true })).toBeVisible({ timeout: 20000 });
}

test("two contexts join the same room", async ({ browser, request }) => {
  const sessionId = await resolveBookedSession(request);
  const studentCookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const teacherCookie = await apiLogin(request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  const student = await pageWithCookie(browser, studentCookie);
  const teacher = await pageWithCookie(browser, teacherCookie);
  await openRoom(student, sessionId);
  await openRoom(teacher, sessionId);
  await expect(student.getByLabel("گفت‌وگوی زندهٔ کلاس")).toBeVisible();
  await student.context().close();
  await teacher.context().close();
});

test("chat relays from student to teacher", async ({ browser, request }) => {
  const sessionId = await resolveBookedSession(request);
  const studentCookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const teacherCookie = await apiLogin(request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  const student = await pageWithCookie(browser, studentCookie);
  const teacher = await pageWithCookie(browser, teacherCookie);
  await openRoom(student, sessionId);
  await openRoom(teacher, sessionId);

  const text = `سلام از E2E ${Date.now()}`;
  await student.getByLabel("پیام جدید").fill(text);
  await student.getByLabel("ارسال پیام").click();

  // teacher's page must show the relayed message (chat:new over the socket)
  await expect(teacher.getByText(text)).toBeVisible({ timeout: 20000 });
  await student.context().close();
  await teacher.context().close();
});

test("whiteboard stroke emitted by teacher reaches the student", async ({ browser, request }) => {
  const sessionId = await resolveBookedSession(request);
  const studentCookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const teacherCookie = await apiLogin(request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  const student = await pageWithCookie(browser, studentCookie);
  const teacher = await pageWithCookie(browser, teacherCookie);
  await openRoom(student, sessionId);
  await openRoom(teacher, sessionId);

  const studentCanvas = student.locator('canvas[aria-label*="تختهٔ سفید کلاس"][width="888"]');
  const teacherCanvas = teacher.locator('canvas[aria-label*="تختهٔ سفید کلاس"][width="888"]');
  await studentCanvas.scrollIntoViewIfNeeded();
  await teacherCanvas.scrollIntoViewIfNeeded();

  // snapshot the student's canvas before the teacher draws
  const before = await studentCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const tbox = await teacherCanvas.boundingBox();
  if (!tbox) throw new Error("teacher canvas not visible");

  // draw with real input events (React pointer handlers fire — verified: the
  // same events drive the teacher's own local stroke)
  await teacher.mouse.move(tbox.x + tbox.width * 0.4, tbox.y + tbox.height * 0.4);
  await teacher.mouse.down();
  await teacher.mouse.move(tbox.x + tbox.width * 0.55, tbox.y + tbox.height * 0.55, { steps: 6 });
  await teacher.mouse.up();

  // the student's canvas must change once the stroke arrives over the socket
  await expect
    .poll(async () => studentCanvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL()), {
      timeout: 15000,
      message: "student canvas never received the teacher's stroke",
    })
    .not.toBe(before);
  await student.context().close();
  await teacher.context().close();
});
