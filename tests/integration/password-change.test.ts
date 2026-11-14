// Integration tests — user-initiated password change (P10)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("POST /users/me/password", () => {
  test("unauthenticated → 401", async () => {
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      json: { currentPassword: "x", newPassword: "yyyyyyyy" },
    });
    expect(r.status).toBe(401);
  });

  test("correct current + valid new → 200; login works with the new password", async () => {
    const email = `pw-${Date.now()}@example.com`;
    const { cookie } = await registerUser(baseUrl(), { email });
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      cookie,
      json: { currentPassword: "test-password-1234", newPassword: "brand-new-pass-99" },
    });
    expect(r.status).toBe(200);
    expect((r.data as { changed: boolean }).changed).toBe(true);

    // old password → 401, new password → 200
    const oldLogin = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "test-password-1234" },
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api(baseUrl(), "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "brand-new-pass-99" },
    });
    expect(newLogin.status).toBe(200);
  });

  test("wrong current password → 400 «رمز فعلی اشتباه است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      cookie,
      json: { currentPassword: "totally-wrong", newPassword: "brand-new-pass-99" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("رمز فعلی اشتباه است");
  });

  test("short new password → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      cookie,
      json: { currentPassword: "test-password-1234", newPassword: "short" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("رمز جدید باید حداقل ۸ کاراکتر باشد");
  });

  test("same as current → 400 «رمز جدید باید متفاوت باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      cookie,
      json: { currentPassword: "test-password-1234", newPassword: "test-password-1234" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("رمز جدید باید متفاوت باشد");
  });

  test("missing fields → 400 «اطلاعات ناقص»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api(baseUrl(), "/api/v1/users/me/password", {
      method: "POST",
      cookie,
      json: { currentPassword: "test-password-1234" },
    });
    expect(r.status).toBe(400);
    expect((r.data as { error: string }).error).toBe("اطلاعات ناقص");
  });
});
