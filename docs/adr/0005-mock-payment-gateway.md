# ADR-0005 — درگاه پرداخت نمایشی (mock) تا e-namad

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED — مهاجرت به زرین‌پال برنامه‌ریزی‌شده در **P10**
- **Date:** 2026-10-30
- **Supersedes:** بخش «Payment Gateway» در DECISIONS v1 (زرین‌پال از MVP).

## Context

درگاه شاپرکی واقعی (زرین‌پال) پیش‌نیازهایی دارد: حساب حقوقی، **e-namad**، و در عمل فعال‌سازی Shaparak. تا زمان آماده‌شدن این‌ها، جریان پرداخت باید برای تست کاملِ حلقه (شارژ کیف پول → رزرو جلسه → خرید دوره → کمیسیون) بدون پول واقعی کار کند.

## Decision

**درگاه نمایشی «پرداخت‌یار»**: یک دیالوگ شبیه‌ساز درگاه (UI مشابه زرین‌پال) که جریان واقعی را طی می‌کند — `Txn(DEPOSIT, PENDING)` → دیالوگ → `POST /wallet/deposit/verify` → `Txn(COMPLETED)` و شارژ کیف پول. کمیسیون ۲۰٪ پلتفرم / ۸۰٪ معلم در همان جریان محاسبه می‌شود.

## Consequences

**(+)** کل چرخهٔ مالی تست‌پذیر از ابتدا؛ ساختار مدل‌ها (`Wallet`, `Txn`) از روز اول شبیه درگاه واقعی.

**(-)** پول واقعی جابه‌جا نمی‌شود؛ **نمی‌توان عمومی و پولی منتشر کرد** — هر استقرار عمومی باید پرچم «حالت آزمایشی» داشته باشد؛ data model هنوز callback/webhook واقعی را تجربه نکرده.

## Migration plan (P10)

زرین‌پال sandbox → production: `payment/request` (دریافت authority) → redirect درگاه → وب‌هوک/redirect verify → به‌روزرسانی همان `Txn`. e-namad پیش‌نیاز سخت است. موجودی‌های نمایشی seed قبل از افتتاح پاک می‌شود.
