// Unit tests — rate limiting pure parts (src/lib/server/rate-limit.ts)
// getClientIp is header logic only. checkRateLimit itself needs a DB; its
// allow/block/window behavior is covered for real (through HTTP, against the
// throwaway server DB) in tests/integration/rate-limit.test.ts — unit workers
// share the live dev DB, so hitting it here would pollute it.
import { describe, test, expect } from "vitest";
import { getClientIp } from "@/lib/server/rate-limit";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/auth/login", { headers });
}

describe("getClientIp", () => {
  test("prefers the first entry of x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  test("falls back to x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  test("returns \"unknown\" without proxy headers", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });

  test("x-forwarded-for wins over x-real-ip", () => {
    expect(
      getClientIp(reqWith({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }))
    ).toBe("1.1.1.1");
  });
});
