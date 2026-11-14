// POST /api/v1/admin/users/[id]/reset — issue a password reset token (P10)
// No email infra: the admin hands the 32-char token to the user over
// WhatsApp/Telegram; the user redeems it at POST /auth/reset/confirm.
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUser();
  if (!admin) return unauthorized();
  if (!admin.isAdmin) return fail("دسترسی ندارید", 403);

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail("کاربر پیدا نشد", 404);
  if (target.isAdmin) return fail("نمی‌توانید رمز مدیر را بازنشانی کنید");

  // Invalidate previous unused tokens — only the newest one works
  await db.passwordResetToken.updateMany({
    where: { userId: id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(16).toString("hex").toUpperCase(); // 32 chars
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

  await db.passwordResetToken.create({
    data: { userId: id, token, expiresAt, createdById: admin.id },
  });

  return ok(
    { token, expiresAt: expiresAt.toISOString(), userFullName: target.fullName, userEmail: target.email },
    201
  );
}
