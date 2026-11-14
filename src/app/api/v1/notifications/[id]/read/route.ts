// POST /api/v1/notifications/[id]/read — mark one notification read (P11)
// Owner-only; 404 for missing or foreign notifications (no existence leak).
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const notification = await db.notification.findUnique({
    where: { id },
    select: { id: true, userId: true, readAt: true },
  });
  if (!notification || notification.userId !== user.id) {
    return fail("اعلان پیدا نشد", 404);
  }

  if (!notification.readAt) {
    await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  return ok({ ok: true });
}
