// مُنت‌آموز — attachment file storage (ADR-0012, P21 step images).
// Local filesystem under uploads/<subdir>/ — no object storage for the
// self-hosted MVP. Pamphlet attachments are NEVER served directly from
// /uploads/; every download goes through an HMAC-signed, 1-hour URL (same
// AUTH_SECRET family as session tokens / room tickets). Step images (P21) are
// content-addressed (uuid keys), so their serve route is public + immutable.
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Default root is the repo's uploads/ dir (ADR-0012). UPLOADS_DIR exists for
// the ephemeral test server: its app copy runs under Turbopack without a .git
// dir, so runtime writes into the watched tree (uploads/, server logs) trigger
// Fast-Refresh rebuild storms that make e2e flaky. The helper points env at a
// throwaway /tmp dir instead — no watched-tree writes at all.
const BASE = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

function dirFor(subdir: string): string {
  // defensive: a subdir must be a plain path segment, never an escape
  const clean = subdir.replace(/[^a-z0-9-]/gi, "");
  return path.join(BASE, clean || "pamphlet-attachments");
}

const DEFAULT_SUBDIR = "pamphlet-attachments";

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

export async function saveFile(buffer: Buffer, ext: string, subdir: string = DEFAULT_SUBDIR): Promise<string> {
  const key = `${crypto.randomUUID()}.${ext}`;
  const dir = dirFor(subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), buffer);
  return key;
}

export async function readFile(storageKey: string, subdir: string = DEFAULT_SUBDIR): Promise<Buffer> {
  return fs.readFile(path.join(dirFor(subdir), storageKey));
}

export async function deleteFile(storageKey: string, subdir: string = DEFAULT_SUBDIR): Promise<void> {
  await fs.unlink(path.join(dirFor(subdir), storageKey)).catch(() => {});
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

/** P17 — same signature contract as the download URL, aimed at the inline
 * HTML preview. Same exp/sig derivation, so one verify function covers both. */
export function signedHtmlUrl(attachmentId: string, ttlSeconds = 3600): string {
  return signedDownloadUrl(attachmentId, ttlSeconds).replace("/download?", "/html?");
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
