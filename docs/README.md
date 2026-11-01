# 📚 مستندات مُنت‌آموز

> **چشم‌انداز (یک پاراگراف):** ساخت **کتابخانهٔ دیجیتال زنده‌ای** از جزوه‌های درسی ایران که در آن معلم‌ها جزوه می‌گذارند، جامعه بازبینی و بهبود می‌دهد (مثل همکاری گیت‌محور روی کد)، بهترین نسخهٔ هر درس برای همه رایگان و آزاد می‌ماند، و به‌تدریج کلاس آنلاین، دورهٔ ویدیویی، آزمون‌ساز و دستیار هوشمند روی همین پایه سوار می‌شود.

## نقشهٔ مستندات

| سند | برای چه کسی | محتوا |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | برنامه‌نویس | معماری **فعلی** (واقعیت کد، نه آرزو) |
| [DECISIONS.md](DECISIONS.md) | همه | فهرست تصمیم‌های فنی پذیرفته‌شده |
| [adr/](adr/) | برنامه‌نویس، نگهدارنده | ۸ سند ADR با دلیل و پیامد |
| [ROADMAP.md](ROADMAP.md) | همه | فازهای انجام‌شده و پیش‌رو |
| [CONTRIBUTING.md](CONTRIBUTING.md) | مشارکت‌کننده | مسیر مشارکت هر نقش |
| [DEVELOPMENT.md](DEVELOPMENT.md) | برنامه‌نویس | محیط توسعه، گردش کار DB، عیب‌یابی |
| [GIT-STRATEGY.md](GIT-STRATEGY.md) | برنامه‌نویس | شاخه‌ها، کامیت، انتشار |
| [DEPLOYMENT.md](DEPLOYMENT.md) | DevOps | طرح استقرار پروداکشن (طرح، هنوز پیاده نشده) |
| [BRAND.md](BRAND.md) | طراح، همه | هویت بصری، پالت، لحن |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | همه | کد رفتاری |
| [../SECURITY.md](../SECURITY.md) | امنیت | گزارش آسیب‌پذیری |
| [../CHANGELOG.md](../CHANGELOG.md) | همه | تاریخچهٔ نسخه‌ها |
| [archive/](archive/) | مورخ 😄 | اسناد چشم‌انداز اولیه (فقط‌خواندنی) |

## مسیر پیشنهادی بر اساس نقش

- **معلم:** [CONTRIBUTING.md بخش معلم](CONTRIBUTING.md) → [ROADMAP.md](ROADMAP.md) → گروه تلگرام
- **توسعه‌دهندهٔ تازه‌وارد:** [../README.md شروع سریع](../README.md) → [DEVELOPMENT.md](DEVELOPMENT.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [DECISIONS.md](DECISIONS.md) + [adr/](adr/)
- **کاربر عادی:** [../README.md](../README.md) کافی است

## کجا کمک بگیرم؟

- **تلگرام:** [t.me/MontAmooz](https://t.me/MontAmooz) — سریع‌ترین راه
- **Discussions گیت‌هاب:** پس از راه‌اندازی ریموت (P2) فعال می‌شود
- **ایمیل بنیان‌گذار:** `mohammad.montajebii@gmail.com`
- **امنیت:** فقط ایمیل — [SECURITY.md](../SECURITY.md)

## قانون طلایی

**پیش از پیشنهاد هر تغییر فنی، [docs/DECISIONS.md](DECISIONS.md) و [docs/adr/](adr/) را بخوانید.** اگر با ADR مخالفید، ADR جدید پیشنهاد دهید — از واگرایی خاموش بپرهیزید.
