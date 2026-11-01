# ADR-0003 — Prisma به‌عنوان ORM

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED
- **Date:** 2026-10-30

## Context

گزینه‌ها: Drizzle (سبک، SQL-near)، raw SQL (کامل ولی پرزحمت)، Prisma (type-safe با DX بالا). پروژه ۱۸ مدل مرتبط دارد (Pamphlet↔Version↔Review↔Fork، Wallet↔Txn، Course↔Lesson↔Enrollment) و توسعهٔ سریع MVP اولویت بود؛ کلاینت تایپ‌سیف Prisma خطای مدل‌محور را در کامپایل می‌گیرد.

## Decision

**Prisma 6** با `prisma-client-js`. اسکیما: `prisma/schema.prisma`؛ دادهٔ نمایشی: `prisma/seed.ts`.

## Consequences

**(+)** Type-safety قوی برای ۱۸ مدل؛ مهاجرت آسان SQLite→PostgreSQL ([ADR-0002](0002-sqlite-mvp-postgres-production.md))؛ `prisma studio` برای مرور داده؛ seed با TypeScript.

**(-)** کندتر از raw SQL در کوئری‌های سنگین؛ bundling پرحجم کلاینت در standalone؛ **مهم:** تا امروز فقط `prisma db push` استفاده شده (بدون فایل‌های مهاجرت) — تاریخچهٔ اسکیما وجود ندارد و `db push --accept-data-loss` ریسک ریزش داده دارد. این باید در P4 با Migrate اصلاح شود.
