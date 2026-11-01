# 🌱 مُنت‌آموز (MontAmooz) — پلتفرم آموزشی Git-inspired

## کتابخانهٔ دیجیتال زندهٔ جزوه‌های درسی ایران — مشارکتی، آزاد، گیت‌محور

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2D3748)](https://www.prisma.io)
[![DB: SQLite (dev)](https://img.shields.io/badge/DB-SQLite%20(dev)%20·%20PostgreSQL%20(planned)-008000)](docs/adr/0002-sqlite-mvp-postgres-production.md)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](#مجوز)
[![Content License: CC BY-SA 4.0](https://img.shields.io/badge/Content%20License-CC%20BY--SA%204.0-lightgrey)](https://creativecommons.org/licenses/by-sa/4.0/)
[![Status: Phase 1+2 MVP](https://img.shields.io/badge/status-Phase%201%2B2%20MVP-yellow)]()
[![GitHub repo](https://img.shields.io/badge/github-MontAmooz%2Fopen--edu--git-181717?logo=github)](https://github.com/MontAmooz/mont-amooz)
![RTL Ready](https://img.shields.io/badge/RTL-پشتیبانی%20کامل-orange)
[![Telegram](https://img.shields.io/badge/تلگرام-گروه%20معلمان-blue)](https://t.me/MontAmooz)

> معلم‌ها جزوه می‌گذارند، جامعه بازبینی می‌کند و بهترش می‌کند — درست مثل همکاری روی کد با گیت. بهترین نسخهٔ هر درس برای همه رایگان و آزاد می‌ماند.

**وضعیت فعلی:** فاز ۱ (کتابخانهٔ جزوه‌ها) و فاز ۲ (کارگاه تدریس: کیف پول، اسلات‌ها، جلسات، دوره‌های ویدیویی، کلاس زنده) **تکمیل شده**. فازهای ۳–۴ و سخت‌سازی پروداکشن برنامه‌ریزی شده‌اند — ببینید [docs/ROADMAP.md](docs/ROADMAP.md).

<!-- اسکرین‌شات‌ها: به‌زودی — docs/images/sample-screenshot.png -->

---

## 🚀 شروع سریع

```bash
bun install
bunx prisma db push
bun prisma/seed.ts
bun run dev
# باز کن: http://localhost:3000
# ورود: montajebii@montamooz.ir / 123456
```

پیش‌نیازها: [bun](https://bun.sh) ≥ 1.3 (راهنمای کامل: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)).

سرویس دوم (کلاس زنده، اختیاری برای توسعهٔ روزمره):

```bash
cd mini-services/classroom-service && bun install && bun run dev
# سلامت: http://localhost:3003/health
```

## 👤 حساب‌های نمایشی (رمز همه: `123456`)

| ایمیل | نام | نقش |
|---|---|---|
| `montajebii@montamooz.ir` | محمدرضا منتجبی | معلم (بنیان‌گذار) |
| `ali.rezaei@montamooz.ir` | علی رضایی | معلم |
| `z.ahmadi@montamooz.ir` | زهرا احمدی | معلم |
| `s.mohammadi@montamooz.ir` | سارا محمدی | معلم |
| `m.karimi@montamooz.ir` | مهدی کریمی | معلم |
| `f.hosseini@montamooz.ir` | فاطمه حسینی | معلم |
| `hossein@montamooz.ir` | حسین نوری | دانش‌آموز |

## 📚 مستندات

| سند | محتوا |
|---|---|
| [docs/README.md](docs/README.md) | نقشهٔ کامل مستندات |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری **فعلی** (واقعیت کد) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | فهرست تصمیم‌های فنی + اصول |
| [docs/adr/](docs/adr/) | ۸ سند ADR (چرا این پشته؟) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | نقشهٔ راه (انجام‌شده و پیش‌رو) |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | راهنمای مشارکت (معلم/برنامه‌نویس/طراح/تایپیست) |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | محیط توسعه و عیب‌یابی |
| [docs/GIT-STRATEGY.md](docs/GIT-STRATEGY.md) | استراتژی شاخه‌ها و انتشار |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | طرح استقرار پروداکشن (هنوز پیاده نشده) |
| [docs/BRAND.md](docs/BRAND.md) | هویت بصری و لحن برند |
| [SECURITY.md](SECURITY.md) | گزارش آسیب‌پذیری |
| [CHANGELOG.md](CHANGELOG.md) | تاریخچهٔ نسخه‌ها |

> نسخه‌های قدیمی این اسناد (چشم‌انداز اولیه با پشتهٔ FastAPI/PostgreSQL) در [docs/archive/2026-10-pre-reconciliation/](docs/archive/2026-10-pre-reconciliation/) نگهداری می‌شوند.

## 📜 مجوز

- **کد پلتفرم:** [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html) — هر سرویس شبکه‌ای که با این کد بالا بیاید، موظف است کد منبع تغییراتش را در دسترس کاربرانش بگذارد. (مجوز تجاری دوگانه برای مدارس/مؤسسات: تماس بگیرید.)
- **محتوای آموزشی:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — نام مؤلف همیشه می‌ماند و مشتقات هم آزاد می‌مانند.

## 👤 بنیان‌گذار و تماس

**محمدرضا منتجبی** — معلم ریاضی مدارس دولتی و نمونه، برنامه‌نویس فول‌استک، عاشق نرم‌افزار آزاد.
باور قلبی: «بهترین آموزگار، جامعه است؛ فقط باید ابزارش را ساخت.»

- ایمیل: `mohammad.montajebii@gmail.com`
- گیت‌هاب: [github.com/montajebii](https://github.com/montajebii)
- تلگرام: [t.me/ATypicalPersianBoy](https://t.me/ATypicalPersianBoy) · گروه: [t.me/MontAmooz](https://t.me/MontAmooz)

---

> *«به امید روزی که هیچ دانش‌آموزی به‌خاطر نبودِ یک توضیح خوب، از درس زده نشود.»*
> *— محمدرضا منتجبی*

### با هم، جزوه‌ای زنده برای همه بسازیم 🌱
