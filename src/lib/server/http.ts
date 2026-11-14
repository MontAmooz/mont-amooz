// مُنت‌آموز — shared HTTP helpers for /api/v1 route handlers.
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { RateLimitError } from "./rate-limit";

/** 429 with Retry-After for a tripped rate limit. */
export function failRateLimit(e: RateLimitError): NextResponse {
  return NextResponse.json(
    { error: e.message },
    { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
  );
}

/** JSON success response. */
export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** JSON error response: { error: message }. */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parse a JSON object body; null when missing/invalid/not an object. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await req.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Current logged-in user (or null) — wrapper kept for DRY imports. */
export async function requireUser() {
  return getCurrentUser();
}

/** If `value` is a member of `allowed`, return it (typed); else null. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return null;
}

/** Safe string cast (null for non-strings). */
export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** 401 response for anonymous callers. */
export function unauthorized(): NextResponse {
  return fail("وارد نشده‌اید", 401);
}
