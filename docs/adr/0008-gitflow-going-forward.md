# ADR-0008 — استراتژی شاخه‌بندی: GitHub Flow (ساده‌شده، به‌جای GitFlow)

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED (بازنگری‌شده 2026-10-30 — پیش‌نویس اول GitFlow بود)
- **Date:** 2026-10-30
- **Supersedes:** پیش‌نویس قبلی همین ADR (GitFlow)

## Context

پیش‌نویس قبلی این ADR، GitFlow کلاسیک (main + develop + feature) را تعیین کرده بود.
واقعیت: توسعه‌دهندهٔ فعلی تک‌نفره است، ADR-0001 فاز MVP را با Next.js جلو برد، و
شاخهٔ `develop` در این مقطع سربار خالص است (بدون فایده‌ای که هزینهٔ merge-day اضافه
کند). بهترین تجربه در تیم‌های کوچک: **GitHub Flow** — یک شاخهٔ پایدار + شاخه‌های
کوتاه‌عمر به ازای هر تغییر.

## Decision

- شاخهٔ پایدار: `main` (محافظت‌شده: PR الزامی، force-push ممنوع، حذف ممنوع،
  حتی مدیران نیز از این قاعده مستثنی نیستند — Q6 کاربر).
- شاخه‌های کوتاه‌عمر: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
  هر شاخه پس از merge حذف می‌شود.
- پیام‌های commit به قالب **Conventional Commits** (feat:, fix:, docs:, chore:, refactor:, test:).
- هیچ شاخهٔ `develop` تا اطلاع ثانوی. اگر روزی تیم به ≥۳ توسعه‌دهنده رسید و نیاز به
  staging branch پیدا شد، ADR جدیدی ثبت می‌شود (Supersedes این).

## Consequences

(+) تاریخچهٔ ساده، تمرکز روی تغییرات کوچک، merge-day ندارد.
(+) branch protection روی `main` حتی برای تک‌نفره، دام «push اشتباه وسط شب» را می‌بندد.
(−) نیاز به discipline فردی برای ایجاد PR حتی برای تغییرات کوچک. برای تسریع، در P3
    CI به‌عنوان status check اجباری می‌شود و ادغام با ۰ approval مجاز است (self-merge).

## Review trigger

- تیم به ≥۳ توسعه‌دهندهٔ فعال رسید.
- نیاز به محیط staging دائمی (که در آن صورت `develop` یا یک شاخهٔ `staging` معنا پیدا می‌کند).
