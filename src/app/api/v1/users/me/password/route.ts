// POST /api/v1/users/me/password — user-initiated password change (P10)
// Requires the current password; rate-limited per user (5/h).
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/server/auth";
import {
  asString,
  fail,
  failRateLimit,
  ok,
  readJson,
  requireUser,
  unauthorized,
} from "@/lib/server/http";
import { checkRateLimit, RateLimitError } from "@/lib/server/rate-limit";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    await checkRateLimit(`pwchange:${user.id}`, 5, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return failRateLimit(e);
    throw e;
  }

  const body = await readJson(req);
  if (!body) return fail("اطلاعات ناقص");

  const currentPassword = asString(body.currentPassword) ?? "";
  const newPassword = asString(body.newPassword) ?? "";
  if (!currentPassword || !newPassword) return fail("اطلاعات ناقص");
  if (newPassword.length < 8) return fail("رمز جدید باید حداقل ۸ کاراکتر باشد");
  if (currentPassword === newPassword) return fail("رمز جدید باید متفاوت باشد");

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });
  if (!row) return fail("کاربر پیدا نشد", 404);

  if (!verifyPassword(currentPassword, row.passwordHash)) {
    return fail("رمز فعلی اشتباه است");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return ok({ changed: true });
}
