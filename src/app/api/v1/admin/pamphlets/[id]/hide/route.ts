// PATCH /api/v1/admin/pamphlets/[id]/hide — soft-hide/unhide a pamphlet (P20).
// hiddenAt set → excluded from every public list and 404 for non-author
// non-admin on detail; the author still sees their own pamphlet.
import { db } from "@/lib/db";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUser();
  if (!admin) return unauthorized();
  if (!admin.isAdmin) return fail("دسترسی ندارید", 403);

  const body = await readJson(req);
  if (!body || typeof body.hidden !== "boolean") {
    return fail("مقدار hidden باید true یا false باشد");
  }

  const { id } = await params;
  const pamphlet = await db.pamphlet.findUnique({ where: { id }, select: { id: true } });
  if (!pamphlet) return fail("جزوه پیدا نشد", 404);

  await db.pamphlet.update({
    where: { id },
    data: { hiddenAt: body.hidden ? new Date() : null },
  });

  return ok({ ok: true, hidden: body.hidden });
}
