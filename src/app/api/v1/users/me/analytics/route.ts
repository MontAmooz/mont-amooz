// GET /api/v1/users/me/analytics — per-pamphlet view/fork/review/MR counts for
// the signed-in teacher (P17). Cumulative counts only (no time windowing —
// schema is frozen; viewCount/reviews/forks/MRs are the existing signals).
import { db } from "@/lib/db";
import { ok, requireUser, unauthorized } from "@/lib/server/http";
import type { TeacherAnalytics } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const pamphlets = await db.pamphlet.findMany({
    where: { authorId: user.id },
    include: {
      _count: {
        select: {
          versions: true,
          reviews: true,
          forks: true,
          targetMRs: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items = pamphlets.map((p) => ({
    id: p.id,
    title: p.title,
    subject: p.subject,
    grade: p.grade,
    viewCount: p.viewCount,
    versionCount: p._count.versions,
    reviewCount: p._count.reviews,
    forkCount: p._count.forks,
    mergeRequestCount: p._count.targetMRs,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const summary = {
    pamphletCount: items.length,
    totalViews: items.reduce((s, p) => s + p.viewCount, 0),
    totalForks: items.reduce((s, p) => s + p.forkCount, 0),
    totalReviews: items.reduce((s, p) => s + p.reviewCount, 0),
    totalMRs: items.reduce((s, p) => s + p.mergeRequestCount, 0),
  };

  const payload: TeacherAnalytics = { items, summary };
  return ok(payload);
}
