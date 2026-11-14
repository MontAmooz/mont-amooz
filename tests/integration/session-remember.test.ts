// Integration tests — remember me session TTL (P10)
// Standard login: 24h max-age; remember-me: 30d. Read from the Set-Cookie header.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

function maxAgeOf(setCookie: string | null): number | null {
  if (!setCookie) return null;
  const m = setCookie.match(/max-age=(\d+)/i);
  return m ? Number(m[1]) : null;
}

describe("Remember me session TTL", () => {
  test("login with rememberMe: true → ~30d cookie", async () => {
    const email = `remember-${Date.now()}@example.com`;
    await registerUser(baseUrl(), { email });
    const r = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "test-password-1234", rememberMe: true },
    });
    expect(r.status).toBe(200);
    expect(maxAgeOf(r.headers.get("set-cookie"))).toBe(60 * 60 * 24 * 30);
  });

  test("login without rememberMe → 24h cookie", async () => {
    const email = `standard-${Date.now()}@example.com`;
    await registerUser(baseUrl(), { email });
    const r = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "test-password-1234" },
    });
    expect(r.status).toBe(200);
    expect(maxAgeOf(r.headers.get("set-cookie"))).toBe(60 * 60 * 24);
  });

  test("rememberMe: false behaves as standard", async () => {
    const email = `explicit-${Date.now()}@example.com`;
    await registerUser(baseUrl(), { email });
    const r = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "test-password-1234", rememberMe: false },
    });
    expect(r.status).toBe(200);
    expect(maxAgeOf(r.headers.get("set-cookie"))).toBe(60 * 60 * 24);
  });
});
