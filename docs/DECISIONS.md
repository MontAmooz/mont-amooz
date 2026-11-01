# 📋 DECISIONS.md — فهرست تصمیم‌های فنی OpenEdu Git (v2)

> این سند **فهرست** تمام تصمیم‌های فنی پذیرفته‌شده است. دلیل کامل هر تصمیم در [docs/adr/](adr/) آمده است.
>
> **نسخهٔ v1 (2026-06-19) این سند** — که پشتهٔ آرزویی FastAPI/PostgreSQL/MinIO را ثبت می‌کرد — در [docs/archive/2026-10-pre-reconciliation/DECISIONS.md](archive/2026-10-pre-reconciliation/DECISIONS.md) آرشیو شده است. آن نسخه برنامهٔ پیش از پیاده‌سازی بود؛ این نسخه (v2) **واقعیت پیاده‌شده + مهاجرت‌های برنامه‌ریزی‌شده** را منعکس می‌کند.

---

## فهرست ADRها

| # | تصمیم | وضعیت | فایل |
|---|---|---|---|
| 0001 | Next.js 16 به‌جای FastAPI | ✅ ACCEPTED | [adr/0001-use-nextjs-instead-of-fastapi.md](adr/0001-use-nextjs-instead-of-fastapi.md) |
| 0002 | SQLite برای توسعه، PostgreSQL برای پروداکشن | ✅ ACCEPTED — مهاجرت در P4 | [adr/0002-sqlite-mvp-postgres-production.md](adr/0002-sqlite-mvp-postgres-production.md) |
| 0003 | Prisma 6 به‌عنوان ORM | ✅ ACCEPTED | [adr/0003-prisma-orm.md](adr/0003-prisma-orm.md) |
| 0004 | نشست کوکی HMAC به‌جای JWT | ✅ ACCEPTED — مهاجرت به JWT در P6 | [adr/0004-hmac-cookie-sessions.md](adr/0004-hmac-cookie-sessions.md) |
| 0005 | درگاه پرداخت نمایشی (mock) تا e-namad | ✅ ACCEPTED — زرین‌پال در P10 | [adr/0005-mock-payment-gateway.md](adr/0005-mock-payment-gateway.md) |
| 0006 | کلاس زنده: چت + تخته (بدون WebRTC فعلاً) | ✅ ACCEPTED — WebRTC در P11 | [adr/0006-chat-whiteboard-classroom.md](adr/0006-chat-whiteboard-classroom.md) |
| 0007 | محتوای جزوه: Markdown در دیتابیس (تا MinIO) | ✅ ACCEPTED — MinIO در P5 | [adr/0007-markdown-in-db.md](adr/0007-markdown-in-db.md) |
| 0008 | GitHub Flow + Conventional Commits (بازنگری از GitFlow) | ✅ ACCEPTED — اعمال در P2 | [adr/0008-gitflow-going-forward.md](adr/0008-gitflow-going-forward.md) |
| 0009 | تست: Vitest (واحد + یکپارچگی سبک)، E2E در P4.6 | ✅ ACCEPTED | [adr/0009-testing-strategy.md](adr/0009-testing-strategy.md) |

---

## اصول ده‌گانهٔ پروژه (از README چشم‌انداز — پابرجا)

1. **آزادی و دسترسی برابر** — هر دانش‌آموزی، فارغ از شهر و هزینه، به بهترین محتوا برسد.
2. **شفافیت** — تاریخچهٔ نسخه‌ها و فرایند داوری برای همه قابل مشاهده است.
3. **احترام به مالکیت فکری** — نام مؤلف همیشه کنار اثرش می‌ماند (CC BY-SA 4.0).
4. **جامعه‌محوری** — بهترین محتوا از دل مشارکت جمعی بیرون می‌آید.
5. **هستهٔ رایگان برای همیشه** — درآمد از خدمات (کلاس/دوره/اشتراک سازمانی)، نه از قفل محتوا.
6. **فارسی‌اول** — RTL پیش‌فرض است، نه افزودهٔ بعدی.
7. **الهام از گیت، اسکن گیت‌هاب نیست** — الگوهای آشنای همکاری، با فرانت‌اند کاملاً سفارشی.
8. **احترام به وزارت آموزش‌وپرورش** — پلتفرم مکمل کتاب رسمی است، نه رقیب آن.
9. **کیفیت از راه داوری جمعی** — رتبه‌بندی و بازبینی عمومی، نه کمیتهٔ متمرکز.
10. **شفافیت فنی** — هر انحراف از برنامهٔ اولیه با ADR مستند می‌شود، نه پنهان.

---

## چگونه یک تصمیم را تغییر دهیم؟

1. به‌جای ویرایش خاموش، **ADR جدید** بنویسید (قالب: Context / Decision / Consequences / Migration plan) و قبلی را `SUPERSEDED by NNNN` کنید.
2. برای بحث، گروه تلگرام (فعلاً) و Discussions گیت‌هاب (پس از P2).
3. بنیان‌گذار تأیید نهایی را می‌دهد؛ سند DECISIONS.md به‌روز می‌شود.

## زمان‌بندی بازنگری

- پس از هر فاز بزرگ (P3، P4، …)
- هنگام کشف محدودیت فنی جدی
- به درخواست هر همکار
