// Integration tests — auth flow (register / login / me / logout)
// Runs against an EPHEMERAL server + throwaway SQLite DB on TEST_PORT (default 3002 —
// never 3000, and 3001 is occupied by a system docker-proxy on the maintainer machine).
// Status expectations reflect ACTUAL route behavior (register returns 201, not 200).
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, stopTestServer } from "../helpers/server";

let baseUrl: string;
let testEmail: string;
let sessionCookie: string;

beforeAll(async () => {
  const s = await startTestServer();
  baseUrl = s.baseUrl;
  testEmail = `test-${Date.now()}@example.com`;
}, 90_000);

afterAll(async () => {
  await stopTestServer();
});

describe("Auth — register", () => {
  test("valid payload returns 201 + PublicUser without email", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "test-password-1234",
        fullName: "کاربر تست",
        role: "معلم",
      }),
    });
    expect(res.status).toBe(201); // actual: route returns ok(..., 201)
    const data = await res.json();
    expect(data.user?.email).toBeUndefined(); // PublicUser must NOT include email
    expect(data.user?.fullName).toBe("کاربر تست");
    expect(data.user?.role).toBe("معلم");
  });

  test("duplicate email returns 409", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "another-password",
        fullName: "Duplicate",
      }),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  test("short password returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `short-${Date.now()}@example.com`,
        password: "123",
        fullName: "Short",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("invalid email returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "long-enough-password",
        fullName: "بدون ایمیل",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("invalid role returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `role-${Date.now()}@example.com`,
        password: "long-enough-password",
        fullName: "نقش غلط",
        role: "فضانورد",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Auth — login", () => {
  test("valid creds return 200 + set oeg_session cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "test-password-1234" }),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/oeg_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    sessionCookie = setCookie!.split(";")[0]; // "oeg_session=..."
  });

  test("bad password returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
  });

  test("missing fields returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Auth — /me and /logout", () => {
  test("/me with valid cookie returns the user", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.fullName).toBe("کاربر تست");
  });

  test("/me without cookie returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    expect(res.status).toBe(401);
  });

  test("/me with forged cookie returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: "oeg_session=eyJhbGc.forged-signature" },
    });
    expect(res.status).toBe(401);
  });

  test("/logout returns 200 and clears the cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/oeg_session=;/); // emptied value
  });

  // CAPTURES ACTUAL BEHAVIOR (documented in /tmp/oeg-diag/22-bugs-found.md):
  // session tokens are stateless HMAC — logout only clears the cookie client-side,
  // the token itself stays valid until expiry. Known limitation (ADR-0004: no revocation).
  test("KNOWN LIMITATION: old cookie still authenticates after /logout (stateless HMAC)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    // Documented in 22-bugs-found.md — do NOT fail on it here; assert the captured reality:
    expect(res.status).toBe(200);
  });
});
