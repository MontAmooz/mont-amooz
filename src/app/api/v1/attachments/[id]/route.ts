// /api/v1/attachments/[id] — GET (public metadata, never storageKey) + DELETE (owner only)
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { deleteFile } from "@/lib/server/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.pamphletAttachment.findUnique({
    where: { id },
    select: {
      id: true,
      pamphletId: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  if (!a) return fail("پیوست پیدا نشد", 404);
  return ok({ ...a, createdAt: a.createdAt.toISOString() });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const a = await db.pamphletAttachment.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      pamphlet: { select: { authorId: true } },
    },
  });
  if (!a) return fail("پیوست پیدا نشد", 404);
  if (a.pamphlet.authorId !== user.id)
    return fail("فقط نویسندهٔ جزوه می‌تواند پیوست را حذف کند", 403);

  await db.pamphletAttachment.delete({ where: { id } });
  await deleteFile(a.storageKey); // best-effort; row is already gone
  return new Response(null, { status: 204 });
}
