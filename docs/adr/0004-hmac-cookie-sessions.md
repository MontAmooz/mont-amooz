# ADR-0004 — نشست‌های کوکی HMAC (تا JWT)

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


<!--
NOTE (added 2026-10-30): The string "montamooz-dev-secret-change-in-production"
below is a post-mortem QUOTE of the pre-P2 vulnerability, retained for documentation.
It is NOT a live credential. It was removed from src/ in commit b20c924 (P2).
Secret-scanning CI is scoped to code files only — do not modify docs to "clean" this.
-->

- **Status:** ACCEPTED — مهاجرت به JWT برنامه‌ریزی‌شده در **P6**
- **Date:** 2026-10-30
- **Supersedes:** بخش «Authentication» در DECISIONS v1 (JWT access + refresh از روز اول).

## Context

MVP به احراز هویت فوری نیاز داشت؛ افزودن کتابخانهٔ JWT + مدیریت refresh/rotation هزینهٔ زمانی داشت. پیاده‌سازی فعلی با `node:crypto` صفر وابستگی است: هش رمز با **scrypt** و توکن نشست = `base64url({uid, iat, exp})` + `.` + **HMAC-SHA256** با `AUTH_SECRET`، در کوکی httpOnly `oeg_session` (۷ روز). بلیت‌های اتاق کلاس هم با همان سازوکار امضا می‌شوند (exp: ۶ ساعت) و در mini-service مستقلاً verify می‌شوند.

⚠️ **نکتهٔ امنیتی جاری:** تا P6 یک fallback مقدار قدیمی در کد هست (`"montamooz-dev-secret-change-in-production"` در `src/lib/server/auth.ts` و `mini-services/classroom-service/index.ts`) و `secure: false` کوکی برای توسعهٔ HTTP. هر دو در P6 حذف/اصلاح می‌شوند؛ `AUTH_SECRET` هم‌اکنون در `.env` تنظیم شده (PROMPT 1 Phase 0).

## Decision

فعلاً: **scrypt + HMAC-SHA256 + کوکی httpOnly**، بدون وابستگی خارجی.

## Consequences

**(+)** صفر وابستگی؛ verify ارزان و stateless؛ یکی‌بودن secret بین اپ و مینی‌سرویس.

**(-)** بدون refresh token و rotation؛ بدون لیست ابطال (خروج = پاک‌کردن کوکی، توکن تا exp از نظر ریاضی معتبر می‌ماند)؛ بدون جداسازی access/refresh.

## Migration plan (P6)

JWT access (۱۵ دقیقه) + refresh (۳۰ روز، چرخشی) + لیست ابطال در DB؛ اعمال `secure: true`؛ حذف fallback از هر دو سرویس؛ migration کوکی‌های موجود (لاگ‌اوت اجباری یک‌باره).
