# ADR-0006 — کلاس زنده: چت + تختهٔ مشارکتی (تا WebRTC)

<!--
NOTE (2026-11-01): The project was renamed from "OpenEdu Git" to مُنت‌آموز / MontAmooz.
Name references in this ADR body were updated to the new name; all other content is unchanged.
See ADR-0011 for the rename decision.
-->


- **Status:** ACCEPTED — WebRTC برنامه‌ریزی‌شده در **P11**
- **Date:** 2026-10-30
- **Supersedes:** بخش WebRTC/Jitsi در نقشهٔ راه فاز ۲ (ماه ۴–۶).

## Context

کلاس آنلاین کامل (صدا/تصویر/ضبط) با WebRTC سنگین است: سرور Signaling + STUN/TURN (TURN روی شبکهٔ ایران خودش پروژه است)، و ادغام Jitsi/LiveKit زمان فاز ۲ را چند برابر می‌کرد. MVP کلاس به «چیزی زنده» نیاز داشت که از پسِ گیت‌وی هم رد شود.

## Decision

**socket.io mini-service مستقل** (`mini-services/classroom-service`، پورت ۳۰۰۳، بدون import از `src/`): چت (relay → broadcast)، **تختهٔ سفید مشارکتی** (stroke/clear/undo با snapshot تا ۸۰۰ استروک)، presence اعضا. احراز با **بلیت HMAC ۶ ساعته** (امضا در اپ، verify در سرویس). اتصال کلاینت از راه Caddy: `io("/?XTransformPort=3003")`.

## Consequences

**(+)** سریع رسید؛ از گیت‌وی HTTP عبور می‌کند؛ ذخیرهٔ پیام‌ها در DB (`SessionMessage`) مستقل از سشنِ سوکت.

**(-)** **صدا و تصویر ندارد** — دانش‌آموزی که جلسهٔ پولی رزرو می‌کند فعلاً فقط چت و تخته می‌گیرد. **این محدودیت باید در UI رزرو صراحتاً افشا شود (اقدام فوری، قبل از P11)** و در ROADMAP ثبت است.

## Migration plan (P11)

افزودن WebRTC (LiveKit self-host کاندید اول؛ TURN داخلی) در همان جلسهٔ موجود؛ بلیت HMAC به‌عنوان توکن ورود اتاق media هم استفاده می‌شود؛ ضبط اختیاری با رضایت طرفین → ذخیره در MinIO (وابسته به [ADR-0007](0007-markdown-in-db.md) / P5).
