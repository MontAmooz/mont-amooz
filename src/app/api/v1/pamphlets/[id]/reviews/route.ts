// /api/v1/pamphlets/[id]/reviews — GET list + POST upsert (auth)
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/auth";
import { asString, fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";
import { reviewInclude, toReviewItem } from "@/lib/server/serializers";

// ---------- GET: list reviews (newest first) ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const reviews = await db.review.findMany({
    where: { pamphletId: id },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
  });

  return ok({ items: reviews.map((r) => toReviewItem(r, user?.id ?? null)) });
}

// ---------- POST: create or update my review ----------
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail("امتیاز باید عددی بین ۱ تا ۵ باشد");
  }
  const comment = asString(body.comment)?.trim() ?? "";
  if (comment.length < 2 || comment.length > 1000) {
    return fail("دیدگاه باید بین ۲ تا ۱۰۰۰ نویسه باشد");
  }

  const pamphlet = await db.pamphlet.findUnique({ where: { id }, select: { id: true, title: true, authorId: true } });
  if (!pamphlet) return fail("جزوه پیدا نشد", 404);

  // P11 — only a FIRST review notifies; editing your own review must not spam
  const existing = await db.review.findUnique({
    where: { pamphletId_userId: { pamphletId: id, userId: user.id } },
    select: { id: true },
  });

  const review = await db.review.upsert({
    where: { pamphletId_userId: { pamphletId: id, userId: user.id } },
    create: { pamphletId: id, userId: user.id, rating, comment },
    update: { rating, comment },
    include: reviewInclude,
  });

  if (!existing) {
    await notify({
      userId: pamphlet.authorId,
      actorId: user.id,
      type: "REVIEW_RECEIVED",
      title: "بازخورد جدید",
      body: `«${user.fullName}» به «${pamphlet.title}» امتیاز داد`,
      linkUrl: `#/pamphlet/${id}`,
      relatedId: id,
      relatedType: "pamphlet",
    });
  }

  return ok({ review: toReviewItem(review, user.id) });
}
