// DELETE /api/v1/comments/[id] — soft-delete a pamphlet comment (P19).
// Author or admin only; the row stays so replies keep their parent and the
// thread renders «[این پیام حذف شده است]» in its place. Idempotent.
import { db } from "@/lib/db";
import { ok, fail, requireUser, unauthorized } from "@/lib/server/http";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const comment = await db.pamphletComment.findUnique({ where: { id } });
  if (!comment) return fail("پیام پیدا نشد", 404);
  if (comment.authorId !== user.id && !user.isAdmin) {
    return fail("فقط نویسنده یا مدیر می‌تواند پیام را حذف کند", 403);
  }
  if (comment.deletedAt) return ok({ ok: true }); // idempotent

  await db.pamphletComment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return ok({ ok: true });
}
