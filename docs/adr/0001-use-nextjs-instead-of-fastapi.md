# ADR-0001 — استفاده از Next.js به‌جای FastAPI

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED
- **Date:** 2026-10-30 (تصمیم عملی در بدو پیاده‌سازی فاز ۱، اکتبر 2026)
- **Supersedes:** بخش «Backend Framework» در DECISIONS v1 (2026-06-19) که Python + FastAPI را تعیین کرده بود.

## Context

DECISIONS v1 برنامهٔ Python + FastAPI + SQLAlchemy را داشت. پیاده‌سازی فاز ۱ در محیطی انجام شد که (۱) اجرای سرویس پایتونی جداگانه را دشوار می‌کرد، (۲) سرعت رسیدن به MVP اولویت اول بود، و (۳) تک‌زبان‌بودن (TS در فرانت و بک) هزینهٔ هماهنگی قرارداد API را حذف می‌کرد. بنیان‌گذار پایتون‌کار است، اما با TypeScript راحت است. علاوه بر این، Next.js 16 هم SSR برای SEO می‌دهد و هم API Routes برای بک‌اند — یک آرتیفکت دیپلوی به‌جای دو تا.

## Decision

**Next.js 16 (App Router) + TypeScript** برای کل اپ: فرانت‌اند SPA (hash routing) و بک‌اند REST (`/api/v1/*` در `src/app/api/`). Prisma به‌جای SQLAlchemy (ببینید [ADR-0003](0003-prisma-orm.md)).

## Consequences

**(+)** یک زبان، یک ریپو، یک آرتیفکت استقرار؛ SSR برای SEO؛ DX سریع؛ type-sharing بین فرانت و بک (`src/lib/types.ts`).

**(-)** واگرایی از DECISIONS v1 (این سند همان را مستند می‌کند)؛ حذف اکوسیستم پایتون (برای فاز AI بعداً سرویس جدا لازم می‌شود)؛ **بدون Swagger خودکار** — قرارداد API به‌صورت دستی نگهداری می‌شود (منبع: `docs/archive/2026-10-pre-reconciliation/worklog-legacy.md`).

## Review trigger

بازنگری اگر: (الف) نیاز جدی به ML/پردازش پایتونی پیدا شد (احتمال زیاد در فاز ۴ — آن‌وقت سرویس AI جداگانه پایتونی می‌شود، نه جایگزین)، (ب) تیم به ۵+ توسعه‌دهنده رسید و مرز فرانت/بک مهم شد، (ج) گلوگاه عملکردی در Node اثبات شد.
