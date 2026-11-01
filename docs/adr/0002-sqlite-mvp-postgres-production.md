# ADR-0002 — SQLite برای توسعه، PostgreSQL برای پروداکشن

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED — مهاجرت به PostgreSQL برنامه‌ریزی‌شده در **P4**
- **Date:** 2026-10-30
- **Supersedes:** بخش «Database & ORM» در DECISIONS v1 (PostgreSQL از روز اول).

## Context

پشتهٔ برنامه‌ریزی‌شده PostgreSQL 16 بود (ACID، JSONB، FTS با pg_trgm/tsvector). اما برای MVP در محیط فعلی: صفر-setup بودن SQLite (یک فایل، بدون سرویس) راه‌اندازی و بازنشانی را فوری می‌کند و Prisma هر دو را با یک تغییر provider پشتیبانی می‌کند. بار فعلی (۷ کاربر نمایشی، ۱۴ جزوه) هیچ‌کدام از مزایای PG را لازم نمی‌کند؛ جستجوی فارسی فعلاً با LIKE روی متنِ نرمال‌شده (`normalizePersian`) انجام می‌شود.

## Decision

**SQLite برای توسعه** (فایل `db/custom.db`، مسیر در `DATABASE_URL` — دقت: نسبت به پوشهٔ `prisma/` حل می‌شود، تلهٔ مستندشده در DEVELOPMENT.md). **PostgreSQL 16 برای پروداکشن** با مهاجرت برنامه‌ریزی‌شده در P4.

## Consequences

**(+)** آنبوردینگ فوری؛ بکاپ = کپی فایل؛ seed سریع؛ بدون وابستگی سرویس خارجی.

**(-)** نوشتار هم‌زمان محدود؛ بدون FTS واقعی (جستجو LIKE است — روی دادهٔ بزرگ کند می‌شود)؛ بدون JSONB؛ رفتار قفل‌گذاری با PG فرق دارد.

## Migration plan (P4)

1. `provider = "postgresql"` در `schema.prisma` + بازبینی typeهای ناسازگار (Datetime، JSON).
2. شروع استفاده از **Prisma Migrate** (تا امروز فقط `db push` — باید در P4 اصلاح شود، ببینید [ADR-0003](0003-prisma-orm.md)).
3. انتقال داده: export از SQLite (script) → import در PG → صحت‌سنجی با شمارش جدول‌ها و `/api/v1/stats`.
4. CI روی PG اجرا شود؛ SQLite فقط برای تست‌های واحد ایزوله بماند.
