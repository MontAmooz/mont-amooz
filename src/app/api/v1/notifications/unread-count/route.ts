// GET /api/v1/notifications/unread-count — lightweight poll target (P11)
// Count-only; covered by @@index([userId, readAt, createdAt]).
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const count = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return ok({ count });
}
