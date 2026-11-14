// /api/v1/notifications — GET (paged list for current user) (P11)
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";
import type { NotificationItem } from "@/lib/types";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const unread = url.searchParams.get("unread") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  const where = { userId: user.id, ...(unread ? { readAt: null } : {}) };
  const [rows, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.notification.count({ where }),
  ]);

  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    linkUrl: n.linkUrl,
    relatedType: n.relatedType,
    relatedId: n.relatedId,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return ok({ items, total, page, pageSize });
}
