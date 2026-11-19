// POST /api/v1/auth/login — email + password → session cookie
// P10: rate-limited per IP (20/h for beta, was 10) + optional remember-me (30d vs 24h).
import { db } from "@/lib/db";
import {
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/server/auth";
import { SESSION_MAX_AGE, SESSION_MAX_AGE_REMEMBER } from "@/lib/constants";
import { asString, fail, failRateLimit, ok, readJson } from "@/lib/server/http";
import { checkRateLimit, getClientIp, RateLimitError } from "@/lib/server/rate-limit";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const email = asString(body.email)?.trim().toLowerCase() ?? "";
  const password = asString(body.password) ?? "";
  if (!email || !password) return fail("ایمیل و رمز عبور الزامی است");

  try {
    // 20/h/IP — raised from 10/h for beta (Iranian CGNAT commonly shares one IP
    // across multiple users; 10/h locked out the second person on any shared network).
    await checkRateLimit(`login:${getClientIp(req)}`, 20, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return failRateLimit(e);
    throw e;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail("ایمیل یا رمز عبور اشتباه است", 401);
  }

  // P10 — remember me: 30 days, standard: 24 hours
  const maxAgeSec = body.rememberMe === true ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE;
  await setSessionCookie(user.id, maxAgeSec);
  return ok({ user: toPublicUser(user) });
}
