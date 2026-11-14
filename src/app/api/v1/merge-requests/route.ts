// /api/v1/merge-requests — GET (filterable list) + POST (create from fork)
import { db } from "@/lib/db";
import { asString, fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";
import { mrInclude, toMRItem } from "@/lib/server/serializers";

// ---------- GET: list (newest first) ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const targetId = url.searchParams.get("targetId") ?? "";
  const sourceId = url.searchParams.get("sourceId") ?? "";

  const items = await db.mergeRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(targetId ? { targetId } : {}),
      ...(sourceId ? { sourceId } : {}),
    },
    include: mrInclude,
    orderBy: { createdAt: "desc" },
  });

  return ok({ items: items.map(toMRItem) });
}

// ---------- POST: create ----------
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const sourceId = asString(body.sourceId) ?? "";
  const targetId = asString(body.targetId) ?? "";
  if (!sourceId || !targetId) return fail("شناسهٔ جزوهٔ مبدأ و مقصد الزامی است");

  const title = asString(body.title)?.trim() ?? "";
  if (title.length < 5 || title.length > 140) {
    return fail("عنوان پیشنهاد باید بین ۵ تا ۱۴۰ نویسه باشد");
  }
  const description = asString(body.description)?.trim() ?? "";
  if (description.length > 1000) return fail("توضیحات حداکثر ۱۰۰۰ نویسه است");

  const [source, target] = await Promise.all([
    db.pamphlet.findUnique({
      where: { id: sourceId },
      select: { id: true, authorId: true, forkedFromId: true },
    }),
    db.pamphlet.findUnique({ where: { id: targetId }, select: { id: true, title: true, authorId: true } }),
  ]);
  if (!source || !target) return fail("جزوه پیدا نشد", 404);
  if (source.authorId !== user.id) {
    return fail("فقط نویسندهٔ جزوهٔ فورک‌شده می‌تواند پیشنهاد ادغام ثبت کند", 403);
  }
  if (source.forkedFromId !== targetId) {
    return fail("پیشنهاد ادغام فقط از جزوهٔ فورک‌شده به جزوهٔ اصلی امکان‌پذیر است", 400);
  }

  const existing = await db.mergeRequest.findFirst({
    where: { sourceId, targetId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) {
    return fail("یک پیشنهاد ادغام باز برای این دو جزوه وجود دارد", 409);
  }

  const mr = await db.mergeRequest.create({
    data: {
      sourceId,
      targetId,
      title,
      description: description || null,
      createdById: user.id,
    },
    select: { id: true },
  });

  // P11 — notify the target pamphlet's owner (after the MR exists; never throws)
  await notify({
    userId: target.authorId,
    actorId: user.id,
    type: "MR_RECEIVED",
    title: "پیشنهاد ادغام جدید",
    body: `«${user.fullName}» برای «${target.title}» پیشنهاد ادغام فرستاد`,
    linkUrl: `#/request/${mr.id}`,
    relatedId: mr.id,
    relatedType: "mr",
  });

  return ok({ id: mr.id }, 201);
}
