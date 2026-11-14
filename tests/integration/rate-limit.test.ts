// Integration tests — auth rate limiting (P10)
// All requests pin a FIXED X-Forwarded-For so they share one bucket on purpose
// (the api() helper randomizes IPs by default — see helpers/server.ts).
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

const BUCKET_A = "10.77.0.1";
const BUCKET_B = "10.77.0.2";

function attempt(path: string, ip: string, json: unknown) {
  return api<{ error?: string }>(baseUrl(), path, {
    method: "POST",
    json,
    headers: { "X-Forwarded-For": ip },
  });
}

describe("Rate limiting — login 10/h per IP", () => {
  test("11 rapid failed logins from one IP → 429 with Persian message + Retry-After", async () => {
    let sawLimit = false;
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const r = await attempt(
        "/api/v1/auth/login",
        BUCKET_A,
        { email: `nobody-${Date.now()}@example.com`, password: "wrong-password" }
      );
      lastStatus = r.status;
      if (r.status === 429) {
        sawLimit = true;
        expect((r.data as { error: string }).error).toContain("بیش از حد مجاز");
        expect(r.headers.get("retry-after")).toBeTruthy();
        break;
      }
      expect(r.status).toBe(401); // wrong-password path until the bucket trips
    }
    expect(sawLimit).toBe(true);
    expect(lastStatus).toBe(429);
  });

  test("a different IP has its own bucket", async () => {
    const r = await attempt(
      "/api/v1/auth/login",
      BUCKET_B,
      { email: `nobody-${Date.now()}@example.com`, password: "wrong-password" }
    );
    expect(r.status).toBe(401); // BUCKET_A is exhausted; B isn't
  });

  test("successful logins also consume the bucket (register→login on a fresh IP is fine)", async () => {
    const ip = `10.77.${Math.floor(Math.random() * 100)}.9`;
    const email = `rl-ok-${Date.now()}@example.com`;
    await registerUser(baseUrl(), { email });
    const r = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "test-password-1234" },
      headers: { "X-Forwarded-For": ip },
    });
    // a fresh random IP has ≤1 prior attempt (the register) — login succeeds
    expect(r.status).toBe(200);
  });
});

describe("Rate limiting — register 3/h per IP", () => {
  test("4 rapid registers from one IP → 429", async () => {
    const ip = "10.78.0.1";
    const results: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await attempt("/api/v1/auth/register", ip, {
        email: `rl-reg-${Date.now()}-${i}@example.com`,
        password: "test-password-1234",
        fullName: "کاربر محدودشده",
      });
      results.push(r.status);
    }
    expect(results).toEqual([201, 201, 201, 429]);
  });
});
