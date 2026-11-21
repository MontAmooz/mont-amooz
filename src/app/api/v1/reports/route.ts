// POST /api/v1/reports — any signed-in user reports a pamphlet or comment (P20).
// Resolution is intentionally separate from action: this only opens a PENDING
// report and notifies every admin; moderation happens via /admin/* endpoints.
import { db } from "@/lib/db";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

const TARGET_TYPES = ["pamphlet", "comment"] as const;
const REASONS = ["spam", "copyright", "inappropriate", "harassment", "other"] as const;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const targetType = oneOf(body.targetType, TARGET_TYPES);
  if (!targetType) return fail("نوع محتوا نامعتبر است");
  const reason = oneOf(body.reason, REASONS);
  if (!reason) return fail("دلیل گزارش نامعتبر است");
  const targetId = asString(body.targetId)?.trim() ?? "";
  if (!targetId) return fail("شناسهٔ محتوا الزامی است");
  const details = asString(body.details)?.trim() ?? "";
  if (details.length > 500) return fail("توضیحات حداکثر ۵۰۰ کاراکتر است");

  // Target must exist and belong to someone else (self-reports are noise)
  let authorId: string | null = null;
  if (targetType === "pamphlet") {
    const p = await db.pamphlet.findUnique({ where: { id: targetId }, select: { authorId: true } });
    if (!p) return fail("جزوه پیدا نشد", 404);
    authorId = p.authorId;
  } else {
    const c = await db.pamphletComment.findUnique({ where: { id: targetId }, select: { authorId: true } });
    if (!c) return fail("پیام پیدا نشد", 404);
    authorId = c.authorId;
  }
  if (authorId === user.id) {
    return fail("نمی‌توانید محتوای خودتان را گزارش دهید");
  }

  const existing = await db.report.findFirst({
    where: { reporterId: user.id, targetType, targetId },
    select: { id: true },
  });
  if (existing) return fail("قبلاً این محتوا را گزارش کرده‌اید", 409);

  const created = await db.report.create({
    data: {
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      details: details || null,
      status: "PENDING",
    },
  });

  // Tell every admin a report arrived (register-route pattern; notify()
  // skips self-notification and never throws into the main action).
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      actorId: user.id,
      type: "ADMIN_REPORT_CREATED",
      title: "گزارش جدید ثبت شد",
      body: `«${user.fullName}» یک ${targetType === "pamphlet" ? "جزوه" : "پیام"} را به دلیل «${reason}» گزارش داد`,
      linkUrl: "#/admin",
      relatedId: created.id,
      relatedType: "pamphlet",
    });
  }

  return ok({ id: created.id }, 201);
}
