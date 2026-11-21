// GET /api/v1/admin/dashboard — founder-only moderation metrics (P20).
// All counters batch in one Promise.all; recent lists reuse the report
// hydration from /admin/reports.
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import type { AdminDashboard, AdminUserRow, ReportItem, ReportTargetType } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return fail("دسترسی ندارید", 403);

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [
    totalUsers,
    newUsersLast7Days,
    suspendedUsers,
    totalPamphlets,
    hiddenPamphlets,
    totalComments,
    totalExams,
    totalLessons,
    pendingReports,
    recentReportRows,
    recentSignupRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { suspendedAt: { not: null } } }),
    db.pamphlet.count(),
    db.pamphlet.count({ where: { hiddenAt: { not: null } } }),
    db.pamphletComment.count({ where: { deletedAt: null } }),
    db.exam.count(),
    db.interactiveLesson.count(),
    db.report.count({ where: { status: "PENDING" } }),
    db.report.findMany({
      include: {
        reporter: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isAdmin: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { pamphlets: true, pamphletComments: true, enrollments: true } },
      },
    }),
  ]);

  // hydrate the 5 recent reports (≤ 5 targets → per-row lookups are fine here)
  const recentReports: ReportItem[] = [];
  for (const r of recentReportRows) {
    let targetSummary = "[محتوا یافت نشد]";
    let targetUrl = "#/admin";
    if (r.targetType === "pamphlet") {
      const p = await db.pamphlet.findUnique({ where: { id: r.targetId }, select: { title: true } });
      if (p) {
        targetSummary = p.title;
        targetUrl = `#/pamphlet/${r.targetId}`;
      }
    } else {
      const c = await db.pamphletComment.findUnique({
        where: { id: r.targetId },
        select: { body: true, deletedAt: true, pamphletId: true },
      });
      if (c) {
        targetSummary = c.deletedAt ? "[حذف شده]" : c.body.slice(0, 100);
        targetUrl = `#/pamphlet/${c.pamphletId}`;
      }
    }
    recentReports.push({
      id: r.id,
      targetType: r.targetType as ReportTargetType,
      targetId: r.targetId,
      targetSummary,
      targetUrl,
      reason: r.reason as ReportItem["reason"],
      details: r.details,
      status: r.status as ReportItem["status"],
      reporter: r.reporter,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    });
  }

  const recentSignups: AdminUserRow[] = recentSignupRows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isAdmin: u.isAdmin,
    suspendedAt: u.suspendedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    walletBalance: null,
    pamphletCount: u._count.pamphlets,
    commentCount: u._count.pamphletComments,
    enrollmentCount: u._count.enrollments,
  }));

  const dashboard: AdminDashboard = {
    metrics: {
      totalUsers,
      newUsersLast7Days,
      suspendedUsers,
      totalPamphlets,
      hiddenPamphlets,
      totalComments,
      totalExams,
      totalLessons,
      pendingReports,
    },
    recentReports,
    recentSignups,
  };
  return ok(dashboard);
}
