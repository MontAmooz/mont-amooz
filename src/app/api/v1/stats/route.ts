// GET /api/v1/stats — platform statistics
import { db } from "@/lib/db";
import { ok } from "@/lib/server/http";

export async function GET() {
  const [
    pamphlets,
    teachers,
    versions,
    reviews,
    forks,
    mergeRequests,
    mergedCount,
    sessions,
    courses,
    exams,
    openSlots,
  ] = await Promise.all([
    db.pamphlet.count(),
    db.user.count({ where: { role: "معلم" } }),
    db.pamphletVersion.count(),
    db.review.count(),
    db.pamphlet.count({ where: { forkedFromId: { not: null } } }),
    db.mergeRequest.count(),
    db.mergeRequest.count({ where: { status: "MERGED" } }),
    // Phase 2 — teaching marketplace
    db.classSession.count({ where: { status: "COMPLETED" } }),
    db.videoCourse.count({ where: { status: "PUBLISHED" } }),
    // P13 — exams + bookable slots (seed-integrity test asserts these)
    db.exam.count({ where: { published: true } }),
    db.teacherSlot.count({
      where: { status: "OPEN", startAt: { gt: new Date() } },
    }),
  ]);

  return ok({
    pamphlets,
    teachers,
    versions,
    reviews,
    forks,
    mergeRequests,
    mergedCount,
    sessions,
    courses,
    exams,
    openSlots,
  });
}
