# ADR-0007 — محتوای جزوه: Markdown در دیتابیس (تا MinIO)

<!--
SUPERSEDED by ADR-0012 (2026-11-13) — content stays Markdown, but optional PDF/Word
attachments were added. See docs/adr/0012-pamphlet-attachments.md.
-->

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED — مهاجرت به MinIO برنامه‌ریزی‌شده در **P5**
- **Date:** 2026-10-30
- **Supersedes:** بخش «File Storage» در DECISIONS v1 + خط لولهٔ LaTeX→PDF سند DEVELOPMENT v1.

## Context

چشم‌انداز اصلی: آپلود PDF/Word/LaTeX با ذخیره در MinIO و کامپایل خودکار LaTeX به PDF. واقعیت MVP: هدف فاز ۱ «متنِ قابل‌خواندن و قابل‌بهبود» بود (فورک و MR روی متن معنا دارد)، نه مدیریت فایل. ذخیرهٔ Markdown به‌عنوان متن در `PamphletVersion.content`، فورک/دیفت/مرج را ساده و شفاف می‌کند.

## Decision

**محتوای جزوه = Markdown در دیتابیس** (`PamphletVersion.content`)، نمایش با رندر Markdown سمت کلاینت. بدون Object Storage فعلاً.

## Consequences

**(+)** صفر زیرساخت؛ دیفت و merge-request روی متن واقعی؛ جستجوی متن جزوه ممکن (همان LIKE نرمال‌شده)؛ نسخه‌بندی ردیفی تمیز.

**(-)** **معلمی که در Word/PDF جزوه می‌نویسد فعلاً نمی‌تواند استفاده کند** — شکاف جدی برای مخاطب اصلی (معلم‌ها)؛ بدون فایل‌های حجیم (ویدیوهای دوره فعلاً فقط دارایی static در `public/` هستند)؛ بدون PDF قابل‌دانلود.

## Migration plan (P5)

MinIO (S3-compatible) + آپلود واقعی (PDF/Word/PPT) با اعتبارسنجی نوع/اندازه؛ پیش‌نمایش PDF در مرورگر؛ دانلود؛ نسخه‌های فایلی کنار نسخه‌های Markdown؛ تبدیل Word→Markdown به‌عنوان راه ورود معلمان فعلی (یا سرویس تایپیست موجود در ROADMAP). URLهای امضاشده برای محتوای پولی.
