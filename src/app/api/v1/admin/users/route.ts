// GET /api/v1/admin/users — founder-only user management list (P10)
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import type { AdminUserRow } from "@/lib/types";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return fail("دسترسی ندارید", 403);

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  const [rows, total] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isAdmin: true,
        createdAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { pamphlets: true, enrollments: true } },
      },
    }),
    db.user.count(),
  ]);

  const items: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    walletBalance: u.wallet?.balance ?? null,
    pamphletCount: u._count.pamphlets,
    enrollmentCount: u._count.enrollments,
  }));

  return ok({ items, total, page, pageSize });
}
