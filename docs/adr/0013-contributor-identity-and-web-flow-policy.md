# ADR-0013 — سیاست هویت Contributor و web-flow

- Status: ACCEPTED
- Date: 2026-11-28
- نتیجهٔ: بندهای ۱، ۲، ۳ و ۵ از «اقدامات پیشنهادی» `docs/ROADMAP_RECOVERY.md §9.6`

## Context

دروازهٔ بهداشت (Hygiene Gate) از 2026-11-28 قرمز بود. ممیزی کامل هویت‌ها روی کل تاریخچه (`docs/ROADMAP_RECOVERY.md §9` — ۴۵ کامیت) چهار کلاس هویتی نشان می‌داد که هیچ‌کدام با رشتهٔ مجاز اولیهٔ تسک مستندسازی، یعنی `montajebii <mohammad.montajebii@gmail.com>`، منطبق نبودند:

1. نام واقعی Git نگهدارنده `Mohammadreza Montajebi` است (ایمیل دقیقاً یکسان) — ۲۲ جایگاه author+committer؛ تطبیق سخت‌گیرانهٔ نام+ایمیل روی کار خود نگهدارنده شکست می‌خورد.
2. هر ۲۲ کامیت ادغام PR دارای جفت هویت استاندارد web-flow گیت‌هاب است: `M0nt <67793307+montajebii@users.noreply.github.com>` (author نتیجهٔ squash-merge) و `GitHub <noreply@github.com>` (committer وب-فلو).
3. `zwork <zwork@local>` — author+committer یک کامیت (`f8cea70`، 2026-11-03، از طریق PR #9) و یک تریلر `Co-authored-by` در بدنهٔ `2502332`.

تا زمان تصمیم انسانی، هیچ تسکی نمی‌توانست ACCEPTED شود (`PROJECT_STATUS.md §J`) و `scripts/check-contributors.sh` عمداً exit 1 می‌داد. هیچ بازنویسی تاریخچه‌ای انجام نشد و در هیچ سناریویی مجاز نیست.

## Decision

سه تصمیمِ تأییدشدهٔ نگهدارنده (2026-11-28):

1. **هویت مرجع (canonical):** `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>` — همان پیکربندی فعلی `git config`. همهٔ کامیت‌های محلی آینده با همین هویت ساخته می‌شوند. رشتهٔ قدیمی `montajebii <…>` منسوخ است (ایمیل یکسان بود؛ فقط نام به‌روزرسانی شد).
2. **اجازهٔ web-flow:** جفت `M0nt <67793307+montajebii@users.noreply.github.com>` و `GitHub <noreply@github.com>` به allowlist اضافه شد — آرتیفکت استاندارد squash-merge گیت‌هاب روی شاخهٔ محافظت‌شدهٔ `main`. ادغام squash از طریق گیت‌هاب (UI یا gh CLI) مجاز می‌ماند؛ روش ادغام تغییر نمی‌کند.
3. **`zwork <zwork@local>`:** به‌عنوان هویت تاریخی پذیرفته و مستند شد (یک کامیت + یک تریلر؛ تاریخ‌ها و SHAها دست‌نخورده). یک مدخل `.mailmap` فقط «نمایش» را به هویت مرجع یکسان می‌کند. بازنویسی تاریخچه، force-push و `filter-repo` ممنوع است.

پیاده‌سازی عملیاتی: allowlist دقیق (تطبیق whole-line با `-x -F`) در `scripts/check-contributors.sh`، و اجرای خودکار آن به‌صورت job جدید `hygiene` در `.github/workflows/hygiene.yml` روی هر PR و هر push به `main` (بند ۵ §9.6 نیز هم‌زمان حل شد). اگر بررسی وضعیت‌های الزامی فعال باشد، `hygiene` باید به فهرست required checks اضافه شود.

## Rationale

- نام واقعی + ایمیل واقعی: منطبق با `git config` و ۴۴ از ۴۵ جایگاه هویتی تاریخچه؛ هیچ تغییر رفتاری برای نگهدارنده لازم نیست.
- allowlist برای web-flow: حذف این جفت یعنی تغییر روش ادغام (ادغام محلی به‌جای squash-merge گیت‌هاب) یا بازنویسی ۲۲ کامیت — هر دو پرهزینه‌اند و این هویت‌ها در عمل همان نگهدارنده است (handle گیت‌هاب `@montajebii`، مطابق `CONTRIBUTORS.md`).
- mailmap به‌جای بازنویسی: مکانیزم استاندارد گیت برای یکسان‌سازی نمایش؛ هیچ شیء git (SHA، تاریخ، دادهٔ author/committer) تغییر نمی‌کند و کلون‌ها/tags/ارجاع‌های CI سالم می‌مانند.

## Consequences

(+) `bash scripts/check-contributors.sh` روی کل تاریخچه exit 0 می‌دهد؛ Hygiene Gate سبز می‌شود و CI آن را روی هر PR تکرار می‌کند.
(+) `.mailmap` فقط خروجی `%aN/%aE` و shortlog را تغییر می‌دهد؛ `git show`/`git log` خام همان دادهٔ تاریخی را نشان می‌دهد.
(−) هر هویت جدیدِ خارج از allowlist، job `hygiene` را قرمز می‌کند — افزودن آن نیازمند اصلاحیهٔ این ADR (یا ADR جدید) با تأیید نگهدارنده است.
(−) تریلر تاریخی `Co-authored-by: zwork` در بدنهٔ پیام `2502332` باقی می‌ماند (بدنهٔ پیام کامیت immutable است)؛ کنترل متنی (`.githooks/commit-msg` و `commit-lint.yml`) فقط کامیت‌های جدید را می‌سنجد.

## Review trigger

- ظهور هر هویت contributor جدید در خروجی job `hygiene`
- تغییر روش ادغام (ترک squash-merge گیت‌هاب) یا محافظت شاخهٔ `main`
- ورود مشارکت‌کنندهٔ دوم به `CONTRIBUTORS.md`
