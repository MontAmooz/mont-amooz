// /api/v1/attachments/[id]/html — inline HTML preview via HMAC-signed URL (P17)
// Same signed-URL contract as /download (exp + sig, 1-hour TTL, AUTH_SECRET).
// Only Word/Markdown/text convert; PDFs stream through the download iframe.
import { db } from "@/lib/db";
import { fail } from "@/lib/server/http";
import { extractHtml } from "@/lib/server/extract";
import { readFile, verifyDownloadSignature } from "@/lib/server/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!Number.isFinite(exp) || !sig || !verifyDownloadSignature(id, exp, sig)) {
    return fail("لینک دسترسی منقضی یا نامعتبر است", 403);
  }

  const a = await db.pamphletAttachment.findUnique({
    where: { id },
    select: { storageKey: true, contentType: true },
  });
  if (!a) return fail("پیوست پیدا نشد", 404);
  if (a.contentType === "application/pdf") {
    return fail("فایل PDF به‌صورت HTML قابل نمایش نیست", 400);
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(a.storageKey);
  } catch {
    return fail("فایل پیوست یافت نشد", 404);
  }

  const html = await extractHtml(buffer, a.contentType);
  if (html === null) {
    return fail("این نوع فایل قابل تبدیل به HTML نیست", 400);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
