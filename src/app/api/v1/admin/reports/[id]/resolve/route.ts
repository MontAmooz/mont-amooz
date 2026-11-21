// POST /api/v1/admin/reports/[id]/resolve — close a report (P20).
// dismiss → DISMISSED; action_taken → ACTION_TAKEN. The target itself is
// NOT modified here — hide/delete/suspend are separate admin calls so the
// audit trail shows the decision and the action independently.
import { db } from "@/lib/db";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";

const ACTIONS = ["dismiss", "action_taken"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUser();
  if (!admin) return unauthorized();
  if (!admin.isAdmin) return fail("دسترسی ندارید", 403);

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");
  const action = oneOf(asString(body.action), ACTIONS);
  if (!action) return fail("عملیات نامعتبر است");

  const { id } = await params;
  const report = await db.report.findUnique({ where: { id } });
  if (!report) return fail("گزارش پیدا نشد", 404);
  if (report.status !== "PENDING") return fail("این گزارش قبلاً بررسی شده است");

  await db.report.update({
    where: { id },
    data: {
      status: action === "dismiss" ? "DISMISSED" : "ACTION_TAKEN",
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });

  return ok({ ok: true });
}
