// مُنت‌آموز — attachment file storage (ADR-0012).
// Local filesystem under uploads/pamphlet-attachments/ — no object storage for
// the self-hosted MVP. Files are NEVER served directly from /uploads/; every
// download goes through an HMAC-signed, 1-hour URL (same AUTH_SECRET family as
// session tokens / room tickets).
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Default root is the repo's uploads/ dir (ADR-0012). UPLOADS_DIR exists for
// the ephemeral test server: its app copy runs under Turbopack without a .git
// dir, so runtime writes into the watched tree (uploads/, server logs) trigger
// Fast-Refresh rebuild storms that make e2e flaky. The helper points env at a
// throwaway /tmp dir instead — no watched-tree writes at all.
const ROOT = path.join(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"),
  "pamphlet-attachments"
);

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/markdown",
  "text/plain",
]);

const MAX_SIZE = 20 * 1024 * 1024;

export function validateFile(contentType: string, sizeBytes: number): void {
  if (!ALLOWED.has(contentType))
    throw new Error("نوع فایل مجاز نیست (فقط PDF، Word، Markdown، متن)");
  if (sizeBytes > MAX_SIZE)
    throw new Error("حجم فایل حداکثر ۲۰ مگابایت است");
  if (sizeBytes === 0)
    throw new Error("فایل خالی است");
}

export async function saveFile(buffer: Buffer, ext: string): Promise<string> {
  const key = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(path.join(ROOT, key), buffer);
  return key;
}

export async function readFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  await fs.unlink(path.join(ROOT, storageKey)).catch(() => {});
}

export function signedDownloadUrl(attachmentId: string, ttlSeconds = 3600): string {
  const SECRET = process.env.AUTH_SECRET;
  if (!SECRET) throw new Error("AUTH_SECRET missing");
  const exp = Date.now() + ttlSeconds * 1000;
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${attachmentId}.${exp}`)
    .digest("base64url");
  return `/api/v1/attachments/${attachmentId}/download?exp=${exp}&sig=${sig}`;
}

export function verifyDownloadSignature(
  attachmentId: string,
  exp: number,
  sig: string
): boolean {
  if (Date.now() > exp) return false;
  const SECRET = process.env.AUTH_SECRET;
  if (!SECRET) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${attachmentId}.${exp}`)
    .digest("base64url");
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
