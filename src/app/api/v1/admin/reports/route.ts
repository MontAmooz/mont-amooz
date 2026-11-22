// GET /api/v1/admin/reports — founder-only report queue (P20).
// Hydrates a short targetSummary per report with two batched fetches
// (all pamphlets, all comments — never per-row queries).
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import type { ReportItem, ReportListResponse, ReportStatus, ReportTargetType } from "@/lib/types";

const STATUSES = ["PENDING", "DISMISSED", "ACTION_TAKEN"] as const;

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return fail("دسترسی ندارید", 403);

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "PENDING";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));

  const where =
    statusParam === "all"
      ? {}
      : (STATUSES as readonly string[]).includes(statusParam)
        ? { status: statusParam }
        : { status: "PENDING" };

  const [rows, total] = await Promise.all([
    db.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.report.count({ where }),
  ]);

  // Batch-hydrate target summaries + the pamphlet URL comments live in
  const pamphletIds = [...new Set(rows.filter((r) => r.targetType === "pamphlet").map((r) => r.targetId))];
  const commentIds = [...new Set(rows.filter((r) => r.targetType === "comment").map((r) => r.targetId))];
  const [pamphlets, comments] = await Promise.all([
    pamphletIds.length
      ? db.pamphlet.findMany({ where: { id: { in: pamphletIds } }, select: { id: true, title: true } })
      : Promise.resolve([] as Array<{ id: string; title: string }>),
    commentIds.length
      ? db.pamphletComment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, body: true, deletedAt: true, pamphletId: true },
        })
      : Promise.resolve([] as Array<{ id: string; body: string; deletedAt: Date | null; pamphletId: string }>),
  ]);
  const pamphletById = new Map(pamphlets.map((p) => [p.id, p]));
  const commentById = new Map(comments.map((c) => [c.id, c]));

  const items: ReportItem[] = rows.map((r) => {
    const p = r.targetType === "pamphlet" ? pamphletById.get(r.targetId) : undefined;
    const c = r.targetType === "comment" ? commentById.get(r.targetId) : undefined;
    const summary = p
      ? p.title
      : c
        ? c.deletedAt
          ? "[حذف شده]"
          : c.body.slice(0, 100)
        : "[محتوا یافت نشد]";
    return {
      id: r.id,
      targetType: r.targetType as ReportTargetType,
      targetId: r.targetId,
      targetSummary: summary,
      targetUrl: c ? `#/pamphlet/${c.pamphletId}` : `#/pamphlet/${r.targetId}`,
      reason: r.reason as ReportItem["reason"],
      details: r.details,
      status: r.status as ReportStatus,
      reporter: r.reporter,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const response: ReportListResponse = { items, total, page, pageSize };
  return ok(response);
}
