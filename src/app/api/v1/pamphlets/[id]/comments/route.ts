// /api/v1/pamphlets/[id]/comments — GET list (public read) + POST create (auth).
// P19 Q&A threads: single-level nesting — replies reference a top-level
// comment; deleted comments keep their row (soft delete) so replies survive.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/auth";
import { asString, fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";
import type { CommentListResponse, PamphletCommentItem } from "@/lib/types";

const AUTHOR_SELECT = { id: true, fullName: true, title: true, isAdmin: true } as const;

// ---------- GET: list comments (top-level, replies nested) ----------
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pamphlet = await db.pamphlet.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!pamphlet) return fail("جزوه پیدا نشد", 404);
  const pamphletAuthorId = pamphlet.authorId; // narrowed value for the closure below

  const viewer = await getCurrentUser();

  const topLevel = await db.pamphletComment.findMany({
    where: { pamphletId: id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: AUTHOR_SELECT },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: AUTHOR_SELECT } },
      },
    },
  });

  const totalCount = await db.pamphletComment.count({ where: { pamphletId: id } });

  function toItem(
    c: (typeof topLevel)[0] | (typeof topLevel)[0]["replies"][0],
    replies: PamphletCommentItem[] = []
  ): PamphletCommentItem {
    return {
      id: c.id,
      body: c.deletedAt ? "" : c.body,
      deleted: !!c.deletedAt,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: {
        id: c.author.id,
        fullName: c.author.fullName,
        title: c.author.title,
        isAdmin: c.author.isAdmin,
        isPamphletAuthor: c.author.id === pamphletAuthorId,
      },
      isMine: viewer?.id === c.author.id,
      replies,
    };
  }

  const items = topLevel.map((top) => toItem(top, top.replies.map((r) => toItem(r))));

  const response: CommentListResponse = { items, total: totalCount };
  return ok(response);
}

// ---------- POST: create a question or reply ----------
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const text = asString(body.body)?.trim() ?? "";
  const parentId = asString(body.parentId);
  if (text.length < 2) return fail("متن پیام حداقل ۲ کاراکتر است");
  if (text.length > 3000) return fail("متن پیام حداکثر ۳۰۰۰ کاراکتر است");

  const pamphlet = await db.pamphlet.findUnique({
    where: { id },
    select: { id: true, title: true, authorId: true },
  });
  if (!pamphlet) return fail("جزوه پیدا نشد", 404);

  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = await db.pamphletComment.findUnique({
      where: { id: parentId },
      select: { id: true, pamphletId: true, parentId: true, authorId: true, deletedAt: true },
    });
    if (!parent) return fail("پیام والد پیدا نشد", 404);
    if (parent.pamphletId !== id) return fail("پیام والد به این جزوه تعلق ندارد");
    if (parent.parentId !== null) return fail("فقط یک سطح پاسخ مجاز است");
    if (parent.deletedAt) return fail("پیام والد حذف شده است");
    parentAuthorId = parent.authorId;
  }

  const created = await db.pamphletComment.create({
    data: {
      pamphletId: id,
      authorId: user.id,
      parentId: parentId ?? null,
      body: text,
    },
  });

  // Notify — reply → parent author; top-level → pamphlet owner. notify()
  // itself skips self-notifications; the guard keeps the intent explicit.
  const recipientId = parentId ? parentAuthorId : pamphlet.authorId;
  if (recipientId && recipientId !== user.id) {
    await notify({
      userId: recipientId,
      actorId: user.id,
      type: "COMMENT_RECEIVED",
      title: parentId ? "پاسخ جدید به پرسش شما" : "پرسش جدید در جزوه‌تان",
      body: `«${user.fullName}» ${parentId ? "به پرسش شما در" : "در"} «${pamphlet.title}» ${parentId ? "پاسخ داد" : "پرسشی مطرح کرد"}`,
      linkUrl: `#/pamphlet/${id}`,
      relatedId: id,
      relatedType: "pamphlet",
    });
  }

  return ok({
    id: created.id,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
    parentId: created.parentId,
  }, 201);
}
