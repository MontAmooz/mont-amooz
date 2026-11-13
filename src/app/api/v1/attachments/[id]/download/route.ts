// /api/v1/attachments/[id]/download — GET via HMAC-signed URL (ADR-0012)
// Public but unguessable: exp + sig query params, 1-hour TTL, signed with
// AUTH_SECRET. The file itself never lives under a served static path.
import { db } from "@/lib/db";
import { fail } from "@/lib/server/http";
import { readFile, verifyDownloadSignature } from "@/lib/server/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!Number.isFinite(exp) || !sig || !verifyDownloadSignature(id, exp, sig)) {
    return fail("لینک دانلود منقضی یا نامعتبر است", 403);
  }

  const a = await db.pamphletAttachment.findUnique({
    where: { id },
    select: { storageKey: true, fileName: true, contentType: true },
  });
  if (!a) return fail("پیوست پیدا نشد", 404);

  let buffer: Buffer;
  try {
    buffer = await readFile(a.storageKey);
  } catch {
    return fail("فایل پیوست یافت نشد", 404);
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": a.contentType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
