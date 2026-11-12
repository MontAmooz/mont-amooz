// P8 — gateway routing gate (approved plan condition #2).
// These two run FIRST because the three classroom specs depend on exactly
// this routing: no XTransformPort → app, XTransformPort=3003 → classroom.
// If these fail, fix here before touching classroom.spec.ts.
import { test, expect } from "@playwright/test";

test("gateway without XTransformPort serves the app", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("مُنت‌آموز");
});

test("gateway with XTransformPort=3003 reaches classroom /health", async ({ request }) => {
  const res = await request.get(`/health?XTransformPort=3003`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
