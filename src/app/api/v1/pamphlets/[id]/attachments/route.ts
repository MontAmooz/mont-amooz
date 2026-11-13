// /api/v1/pamphlets/[id]/attachments — POST (owner upload, multipart) + GET (public list)
// ADR-0012 — optional file attachment alongside the Markdown content.
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { extractText } from "@/lib/server/extract";
import { saveFile, signedDownloadUrl, validateFile } from "@/lib/server/storage";
import type { PamphletAttachmentItem } from "@/lib/types";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/markdown",
  "text/plain",
]);

const TEXT_MIMES = new Set(["text/markdown", "text/plain"]);

/** Extension from the original filename ("" when absent). */
function extFromName(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const pamphlet = await db.pamphlet.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!pamphlet) return fail("جزوه پیدا نشد", 404);
  if (pamphlet.authorId !== user.id)
    return fail("فقط نویسندهٔ جزوه می‌تواند پیوست اضافه کند", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("داده‌های ارسالی نامعتبر است");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return fail("فایلی ارسال نشده است");
  const versionIdParam = form.get("versionId");

  // ADR-0012 — declared type/size gate (Persian errors bubble from validateFile)
  const contentType = file.type || "";
  try {
    validateFile(contentType, file.size);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "فایل نامعتبر است");
  }

  // Magic-byte cross-check via file-type. Text files have no magic bytes —
  // they pass on the declared type alone; binaries must match what was declared.
  const buffer = Buffer.from(await file.arrayBuffer());
  const { fileTypeFromBuffer } = await import("file-type");
  const ft = await fileTypeFromBuffer(buffer);
  if (ft) {
    if (ft.mime !== contentType || !ALLOWED_MIMES.has(ft.mime)) {
      return fail("نوع فایل تشخیص داده نشد");
    }
  } else if (!TEXT_MIMES.has(contentType)) {
    return fail("نوع فایل تشخیص داده نشد");
  }

  // Attachment rides on a version — default: latest
  const versions = await db.pamphletVersion.findMany({
    where: { pamphletId: id },
    select: { id: true, versionNumber: true },
    orderBy: { versionNumber: "desc" },
  });
  if (versions.length === 0) return fail("جزوه نسخه‌ای ندارد", 400);
  let versionId = versions[0].id;
  if (typeof versionIdParam === "string" && versionIdParam) {
    const hit = versions.find((v) => v.id === versionIdParam);
    if (!hit) return fail("نسخهٔ موردنظر برای این جزوه وجود ندارد", 400);
    versionId = hit.id;
  }

  const ext = ft?.ext ?? extFromName(file.name) ?? "";
  const storageKey = await saveFile(buffer, ext || "bin");
  const extractedText = await extractText(buffer, contentType); // non-fatal

  const created = await db.pamphletAttachment.create({
    data: {
      pamphletId: id,
      versionId,
      fileName: file.name || `پیوست.${ext}`,
      storageKey,
      contentType,
      sizeBytes: file.size,
      extractedText,
      uploadedById: user.id,
    },
    select: { id: true },
  });

  return ok({ id: created.id, signedUrl: signedDownloadUrl(created.id) }, 201);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await db.pamphlet.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return fail("جزوه پیدا نشد", 404);

  const rows = await db.pamphletAttachment.findMany({
    where: { pamphletId: id },
    select: { id: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const items: PamphletAttachmentItem[] = rows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    signedUrl: signedDownloadUrl(a.id),
    createdAt: a.createdAt.toISOString(),
  }));
  return ok({ items });
}
