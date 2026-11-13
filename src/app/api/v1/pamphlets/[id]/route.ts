// GET /api/v1/pamphlets/[id] — PamphletDetail (increments viewCount)
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/auth";
import { signedDownloadUrl } from "@/lib/server/storage";
import { fail, ok } from "@/lib/server/http";
import {
  buildContributors,
  pamphletSummaryInclude,
  toPamphletSummary,
  toReviewItem,
} from "@/lib/server/serializers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const p = await db.pamphlet.findUnique({
    where: { id },
    include: {
      ...pamphletSummaryInclude,
      versions: {
        select: {
          id: true,
          versionNumber: true,
          content: true,
          changeSummary: true,
          createdAt: true,
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { versionNumber: "desc" },
      },
      contributions: {
        include: { user: { select: { id: true, fullName: true } } },
      },
    },
  });
  if (!p) return fail("جزوه پیدا نشد", 404);

  // Fire-and-forget view counter (best-effort).
  void db.pamphlet
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  const [openMergeRequestCount, myReviewRow] = await Promise.all([
    db.mergeRequest.count({ where: { targetId: id, status: "OPEN" } }),
    user
      ? db.review.findUnique({
          where: { pamphletId_userId: { pamphletId: id, userId: user.id } },
          include: {
            user: { select: { id: true, fullName: true, title: true } },
            votes: { select: { userId: true, value: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const latest = p.versions[0];

  return ok({
    ...toPamphletSummary(p),
    content: latest?.content ?? "",
    latestVersionNumber: latest?.versionNumber ?? 0,
    versions: p.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      changeSummary: v.changeSummary,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy,
    })),
    contributors: buildContributors(p.contributions, p.authorId),
    attachments: p.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      signedUrl: signedDownloadUrl(a.id),
      createdAt: a.createdAt.toISOString(),
    })),
    openMergeRequestCount,
    isMine: !!user && user.id === p.authorId,
    myReview: myReviewRow ? toReviewItem(myReviewRow, user?.id ?? null) : null,
  });
}
