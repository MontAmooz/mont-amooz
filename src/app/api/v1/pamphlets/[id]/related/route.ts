// GET /api/v1/pamphlets/[id]/related — content discovery (P17).
// Two buckets, deduped to 6 max: same subject (any grade) first, then same
// grade + same teaching method. Published only, most-viewed first.
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/server/http";
import { pamphletSummaryInclude, toPamphletSummary } from "@/lib/server/serializers";
import type { RelatedPamphletsResponse } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const source = await db.pamphlet.findUnique({
    where: { id },
    select: { id: true, subject: true, grade: true, teachingMethod: true },
  });
  if (!source) return fail("جزوه پیدا نشد", 404);

  const [sameSubject, sameGradeMethod] = await Promise.all([
    db.pamphlet.findMany({
      where: { id: { not: id }, subject: source.subject, status: "PUBLISHED" },
      include: pamphletSummaryInclude,
      orderBy: [{ viewCount: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
    db.pamphlet.findMany({
      where: {
        id: { not: id },
        grade: source.grade,
        teachingMethod: source.teachingMethod,
        status: "PUBLISHED",
      },
      include: pamphletSummaryInclude,
      orderBy: [{ viewCount: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
  ]);

  // sameSubject bucket keeps priority; dedupe + cap at 6
  const seen = new Set<string>();
  const merged = [...sameSubject, ...sameGradeMethod]
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, 6);

  const response: RelatedPamphletsResponse = {
    items: merged.map((p) => toPamphletSummary(p)),
  };
  return ok(response);
}
