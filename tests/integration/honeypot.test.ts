// Integration tests — registration honeypot (P10)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

function register(json: Record<string, unknown>) {
  return api<{ user?: { fullName: string }; error?: string }>(
    baseUrl(),
    "/api/v1/auth/register",
    { method: "POST", json }
  );
}

describe("Register honeypot", () => {
  test("empty website field → normal 201 registration", async () => {
    const email = `human-${Date.now()}@example.com`;
    const r = await register({
      email,
      password: "test-password-1234",
      fullName: "کاربر انسانی",
      website: "",
    });
    expect(r.status).toBe(201);
    expect(r.data.user?.fullName).toBe("کاربر انسانی");
  });

  test("filled website field → 400 «درخواست نامعتبر» (bot)", async () => {
    const r = await register({
      email: `bot-${Date.now()}@example.com`,
      password: "test-password-1234",
      fullName: "ربات بی‌ادب",
      website: "http://spam.example",
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("درخواست نامعتبر");
  });
});
