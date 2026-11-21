// PATCH /api/v1/admin/users/[id]/suspend — suspend/unsuspend a user (P20).
// suspendedAt set → the login route refuses with 403 and getCurrentUser()
// returns null, so every existing session dies on its very next request
// (HMAC tokens carry no revocation list — the check lives on the user row).
import { db } from "@/lib/db";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUser();
  if (!admin) return unauthorized();
  if (!admin.isAdmin) return fail("دسترسی ندارید", 403);

  const body = await readJson(req);
  if (!body || typeof body.suspended !== "boolean") {
    return fail("مقدار suspended باید true یا false باشد");
  }

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return fail("کاربر پیدا نشد", 404);
  if (target.isAdmin) return fail("نمی‌توانید مدیر را معلق کنید");

  await db.user.update({
    where: { id },
    data: { suspendedAt: body.suspended ? new Date() : null },
  });

  return ok({ ok: true, suspended: body.suspended });
}
