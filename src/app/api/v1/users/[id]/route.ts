// GET /api/v1/users/[id] — public profile + authored pamphlets + stats (+ Phase 2 teach/courses)
import { db } from "@/lib/db";
import { toPublicUser } from "@/lib/server/auth";
import { fail, ok } from "@/lib/server/http";
import {
  courseCardInclude,
  pamphletSummaryInclude,
  round1,
  toCourseCard,
  toExamSummary,
  toPamphletSummary,
} from "@/lib/server/serializers";
import type { UserProfileTeach } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      title: true,
      bio: true,
      expertise: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) return fail("کاربر پیدا نشد", 404);

  const now = new Date();
  const [
    pamphletRows,
    mergedCount,
    contributionSum,
    reviewCount,
    openSlots,
    completedSessions,
    sessionReviews,
    courseRows,
    examRows,
  ] = await Promise.all([
    db.pamphlet.findMany({
      where: { authorId: id },
      include: pamphletSummaryInclude,
      orderBy: { updatedAt: "desc" },
    }),
    db.mergeRequest.count({ where: { createdById: id, status: "MERGED" } }),
    db.contribution.aggregate({ where: { userId: id }, _sum: { score: true } }),
    db.review.count({ where: { userId: id } }),
    // Phase 2 — marketplace profile data
    db.teacherSlot.findMany({
      where: { teacherId: id, status: "OPEN", startAt: { gt: now } },
      select: { price: true },
    }),
    db.classSession.count({ where: { teacherId: id, status: "COMPLETED" } }),
    db.sessionReview.findMany({
      where: { session: { teacherId: id, status: "COMPLETED" } },
      select: { rating: true },
    }),
    db.videoCourse.findMany({
      where: { teacherId: id, status: "PUBLISHED" },
      include: courseCardInclude,
      orderBy: { createdAt: "desc" },
    }),
    db.exam.findMany({
      where: { teacherId: id, published: true },
      include: {
        teacher: { select: { id: true, fullName: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
        attempts: { select: { score: true, maxScore: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pamphlets = pamphletRows.map(toPamphletSummary);
  const avgRating = pamphlets.length
    ? round1(pamphlets.reduce((s, p) => s + p.ratingAvg, 0) / pamphlets.length)
    : 0;

  const teach: UserProfileTeach = {
    openSlots: openSlots.length,
    minSlotPrice: openSlots.length ? Math.min(...openSlots.map((s) => s.price)) : null,
    completedSessions,
    avgSessionRating: sessionReviews.length
      ? round1(sessionReviews.reduce((s, r) => s + r.rating, 0) / sessionReviews.length)
      : 0,
    sessionRatingCount: sessionReviews.length,
    courseCount: courseRows.length,
  };

  return ok({
    user: toPublicUser(user),
    pamphlets,
    stats: {
      pamphletCount: pamphlets.length,
      mergedCount,
      avgRating,
      linesContributed: Math.round(contributionSum._sum.score ?? 0),
      reviewCount,
    },
    teach,
    courses: courseRows.map(toCourseCard),
    exams: examRows.map(toExamSummary),
  });
}
