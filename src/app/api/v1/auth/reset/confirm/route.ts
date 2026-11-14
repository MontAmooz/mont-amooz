// POST /api/v1/auth/reset/confirm — redeem an admin-issued reset token (P10)
// Public, rate-limited per IP (5/h). Token: single use, 24h expiry.
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/server/auth";
import { asString, fail, failRateLimit, ok, readJson } from "@/lib/server/http";
import { checkRateLimit, getClientIp, RateLimitError } from "@/lib/server/rate-limit";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("اطلاعات ناقص");

  const token = asString(body.token)?.trim() ?? "";
  const newPassword = asString(body.newPassword) ?? "";
  if (!token || !newPassword) return fail("اطلاعات ناقص");
  if (newPassword.length < 8) return fail("رمز جدید باید حداقل ۸ کاراکتر باشد");

  try {
    await checkRateLimit(`reset:${getClientIp(req)}`, 5, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return failRateLimit(e);
    throw e;
  }

  const record = await db.passwordResetToken.findUnique({
    where: { token: token.toUpperCase() },
  });
  if (!record) return fail("کد نامعتبر است");
  if (record.usedAt) return fail("این کد قبلاً استفاده شده است");
  if (record.expiresAt < new Date()) return fail("این کد منقضی شده است");

  const newHash = hashPassword(newPassword);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: newHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return ok({ reset: true });
}
