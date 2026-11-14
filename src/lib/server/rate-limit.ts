// مُنت‌آموز — SQLite-backed rate limiting for auth endpoints (P10).
// One RateLimitAttempt row per attempt; a check counts rows for the key inside
// the window and records the new attempt. No external store — the platform has
// no Redis/MinIO by design (self-hosted MVP; ADR-0012 rationale applies).
import { db } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(
    public retryAfterSec: number,
    message: string
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<void> {
  const since = new Date(Date.now() - windowSec * 1000);

  // Count recent attempts
  const count = await db.rateLimitAttempt.count({
    where: { key, createdAt: { gte: since } },
  });

  if (count >= limit) {
    throw new RateLimitError(
      windowSec,
      `تعداد تلاش‌ها بیش از حد مجاز. لطفاً ${Math.ceil(windowSec / 60)} دقیقه صبر کنید.`
    );
  }

  // Record attempt (fire-and-forget; don't block on errors)
  await db.rateLimitAttempt.create({ data: { key } }).catch(() => {});

  // Cleanup old records (fire-and-forget)
  db.rateLimitAttempt
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
    .catch(() => {});
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
