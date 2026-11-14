// POST /api/v1/merge-requests/[id]/review — approve | reject (target author only)
import { db } from "@/lib/db";
import { lineDiff } from "@/lib/diff";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return fail("عملیات باید «approve» یا «reject» باشد");
  }

  const mr = await db.mergeRequest.findUnique({
    where: { id },
    include: {
      source: {
        select: {
          authorId: true,
          versions: { select: { content: true }, orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
      target: {
        select: {
          authorId: true,
          versions: { select: { content: true }, orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!mr) return fail("پیشنهاد ادغام پیدا نشد", 404);
  if (mr.target.authorId !== user.id) {
    return fail("فقط نویسندهٔ جزوهٔ اصلی می‌تواند تصمیم بگیرد", 403);
  }
  if (mr.status !== "OPEN") {
    return fail("این پیشنهاد ادغام قبلاً بررسی شده است", 400);
  }

  // ----- reject -----
  if (action === "reject") {
    await db.mergeRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date() },
    });
    // P11 — notify the MR creator (source pamphlet owner)
    await notify({
      userId: mr.source.authorId,
      actorId: user.id,
      type: "MR_REVIEWED",
      title: "پیشنهاد ادغام شما رد شد",
      body: `«${user.fullName}» پیشنهاد شما برای «${mr.title}» را رد کرد`,
      linkUrl: `#/request/${id}`,
      relatedId: id,
      relatedType: "mr",
    });
    return ok({ status: "REJECTED" });
  }

  // ----- approve: merge source's latest content into target -----
  const sourceContent = mr.source.versions[0]?.content ?? "";
  const targetContent = mr.target.versions[0]?.content ?? "";
  const diff = lineDiff(targetContent, sourceContent);
  const gain = Math.max(diff.addedCount, 1);

  const maxVersion = await db.pamphletVersion.aggregate({
    where: { pamphletId: mr.targetId },
    _max: { versionNumber: true },
  });
  const nextNumber = (maxVersion._max.versionNumber ?? 0) + 1;

  await db.$transaction([
    db.mergeRequest.update({
      where: { id },
      data: { status: "MERGED", reviewedById: user.id, reviewedAt: new Date() },
    }),
    db.pamphletVersion.create({
      data: {
        pamphletId: mr.targetId,
        versionNumber: nextNumber,
        content: sourceContent,
        changeSummary: `ادغام پیشنهاد «${mr.title}»`,
        createdById: mr.source.authorId,
      },
    }),
    db.pamphlet.update({
      where: { id: mr.targetId },
      data: { updatedAt: new Date() },
    }),
    db.contribution.upsert({
      where: {
        pamphletId_userId: { pamphletId: mr.targetId, userId: mr.source.authorId },
      },
      create: { pamphletId: mr.targetId, userId: mr.source.authorId, score: gain },
      update: { score: { increment: gain } },
    }),
  ]);

  // P11 — notify the MR creator (after the merge transaction commits)
  await notify({
    userId: mr.source.authorId,
    actorId: user.id,
    type: "MR_REVIEWED",
    title: "پیشنهاد ادغام شما تأیید شد",
    body: `«${user.fullName}» پیشنهاد شما برای «${mr.title}» را تأیید و ادغام کرد`,
    linkUrl: `#/request/${id}`,
    relatedId: id,
    relatedType: "mr",
  });

  return ok({ status: "MERGED" });
}
