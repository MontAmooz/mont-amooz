# ADR-0012 — پیوست‌های PDF/Word برای جزوه‌ها (supersedes ADR-0007)

- Status: ACCEPTED
- Date: 2026-11-13
- Supersedes: ADR-0007 (markdown-in-db)

## Context

ADR-0007 اعلام کرد محتوا فقط Markdown است. اما ۷۰٪ معلمان ایران جزوه را با Word/PDF تولید می‌کنند. بدون حمایت از این فرمت‌ها، پلتفرم برای آن‌ها قابل استفاده نیست.

## Decision

- محتوای Markdown حفظ می‌شود (search، نسخه‌بندی، ویرایش).
- **پیوست اختیاری** (PDF، docx، doc، md، txt) در کنار آن.
- ذخیره‌سازی: **فایل‌سیستم محلی** (`uploads/pamphlet-attachments/`)، نه MinIO/S3.
- دانلود از طریق **لینک امضاشده HMAC** (انقضا ۱ ساعت).
- استخراج متن از PDF/Word و درج در `extractedText` برای search.
- حداکثر حجم: ۲۰ مگابایت. یک پیوست در هر نسخه (MVP).

## Rationale

- **Local fs نه MinIO**: self-hosted MVP، بدون deploy. MinIO یعنی یک سرویس اضافه که باید backup/secure/scale شود. برای ۷ کاربر فعلی (و ۱۰۰ کاربر آینده) دیسک محلی کافی است. Backup = کپی `uploads/` (systemd timer موجود).
- **Hybrid نه PDF-only**: Markdown searchable است. اگر کسی PDF-only آپلود کند، search روی متن استخراج‌شده اجرا می‌شود (مگر PDF scan‌شده باشد که text layer ندارد).
- **HMAC-signed URLs نه public access**: حتی بدون لاگین، فایل مستقیم از `/uploads/` قابل دسترسی نیست.

## Consequences

(+) بدون سرویس خارجی؛ backup ساده؛ کار روی یک host؛ سازگار با مدل موجود.
(−) تک-host فقط (no CDN, no multi-node). PDF scan‌شده قابل search نیست. ویدیو/صوت پشتیبانی نمی‌شود.

## Implementation notes (P9)

- `pdf-parse` v2 یک کلاس (`PDFParse`) ارائه می‌دهد، نه تابع پیش‌فرض نسخهٔ ۱. worker پیش‌فرض pdfjs («./pdf.worker.mjs») زیر Turbopack resolve نمی‌شود؛ `src/lib/server/extract.ts` با `PDFParse.setWorker()` مسیر مطلق worker داخل `node_modules` را ست می‌کند. بدون این، استخراج متن PDF بی‌صدا `null` می‌شد.
- سرور تست اphemeral (و هر محیط dev بدون `.git/`) یک کپی rsync از پروژه است؛ نوشتن فایل runtime داخل درخت پروژه (مثل `uploads/`) باعث Fast-Refresh rebuild storm و ناپایداری e2e می‌شود. متغیر `UPLOADS_DIR` در `tests/helpers/server.ts` پیوست‌ها را به `/tmp` می‌برد؛ پیش‌فرض پروداکشن همان `uploads/` باقی می‌ماند.
- استخراج متن best-effort است: هر خطایی → `null` و آپلود سرِ جای خودش می‌ماند (فایل فقط searchable نمی‌شود).

## Migration to MinIO

وقتی یکی از این شرایط رخ دهد:
- نیاز به CDN برای سرعت دانلود
- حجم > 10GB
- چند host / K8s

اقدام: پکیج MinIO، تغییر `storage.ts` برای استفاده از S3 SDK، انتقال فایل‌های موجود، حفظ signed URL contract.

## Review trigger

- video/audio uploads خواسته شد
- حجم از 10GB گذشت
- deploy production
