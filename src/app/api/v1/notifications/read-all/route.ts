// POST /api/v1/notifications/read-all — mark every unread notification read (P11)
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";

export async function POST() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const updated = await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ updated: updated.count });
}
