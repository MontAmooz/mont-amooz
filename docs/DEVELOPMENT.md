# ⚙️ DEVELOPMENT.md — راهنمای محیط توسعه مُنت‌آموز

> وضعیت واقعی کدبیس: **Next.js 16 + Prisma + SQLite + socket.io mini-service**. (راهنمای قدیمی docker-compose/FastAPI در [archive](archive/2026-10-pre-reconciliation/DEVELOPMENT.md) است.)

## پیش‌نیازها

| ابزار | نسخه | چک |
|---|---|---|
| [bun](https://bun.sh) | ≥ 1.3 | `bun --version` |
| Node.js | ≥ 20 | (بون جایگزینش می‌کند، ولی Next به آن نیاز دارد) |
| openssl | هر | برای تولید `AUTH_SECRET` |
| prisma CLI | با bunx | نصب جدا لازم نیست |

## راه‌اندازی (از صفر)

```bash
git clone <remote> mont-amooz && cd mont-amooz   # ریموت در P2 اضافه می‌شود
bun install

cp .env.example .env          # سپس مقادیر واقعی را بگذارید:
#   DATABASE_URL="file:../db/custom.db"
#   AUTH_SECRET=$(openssl rand -hex 32)

bunx prisma db push           # ساخت اسکیمای SQLite
bun prisma/seed.ts            # دادهٔ نمایشی: ۷ کاربر، ۱۴ جزوه، ۵ دوره، ۲۹ اسلات
bun run dev                   # http://localhost:3000
```

سرویس کلاس زنده (پایگاه جدا، فقط وقتی کلاس کار می‌کنید):

```bash
cd mini-services/classroom-service
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env   # یا همان secret ریشه
bun install && bun run dev                          # :3003
curl localhost:3003/health                          # {"ok":true}
```

⚠️ `AUTH_SECRET` دو سرویس **باید یکی باشد** (بلیت‌های اتاق با همان secret امضا و verify می‌شوند).

## متغیرهای محیطی

| کلید | معنا | جاها |
|---|---|---|
| `DATABASE_URL` | مسیر SQLite — **نسبت به `prisma/schema.prisma`** حل می‌شود | ریشه `.env` |
| `AUTH_SECRET` | کلید HMAC نشست‌ها و بلیت‌ها | ریشه `.env` + `mini-services/classroom-service/.env` |

الگوی کامل: [.env.example](../.env.example)

## سرویس‌ها و پورت‌ها

| سرویس | پورت | راه‌اندازی |
|---|---|---|
| Next.js (فرانت + API) | 3000 | `bun run dev` |
| classroom-service (socket.io) | 3003 | `cd mini-services/classroom-service && bun run dev` |
| Caddy گیت‌وی (اختیاری) | 81 | `caddy run --config Caddyfile` — برای تست WebSocket مرورگر |

اسکریپت‌های `package.json`: `dev`, `build`, `start`, `lint`, `db:push`, `db:generate`, `db:migrate`, `db:reset`.

## گردش کار دیتابیس (SQLite)

```bash
bun run db:push          # اعمال schema.prisma روی db  (accept-data-loss در dev)
bun prisma generate      # بازتولید کلاینت پس از تغییر اسکیما
bun prisma/seed.ts       # بازنشانی دادهٔ نمایشی — پس از هر db push اجرا کنید
bun prisma studio        # مرورگر داده
```

> ریزش داده هنگام `db push` طبیعی است (dev)؛ seed همه‌چیز را برمی‌گرداند.

## تست (وضعیت فعلی)

- **دستی:** curl برای API (نمونه‌ها در SECURITY/ARCHITECTURE) + مرورگر برای UI
- **کلاس دو-نشسته:** دو پنجرهٔ مرورگر، ورود با `montajebii@montamooz.ir` و `hossein@montamooz.ir`، رفتن به `#/session/<CODE>`، تست چت + تخته
- تست‌های خودکار: برنامه‌ریزی در P3 — تا آن موقع تست بنویسید ولی برای CI صبر کنید

## عیب‌یابی

### ⚠️ مهم‌ترین تلهٔ این ریپو: مسیر دیتابیس

`DATABASE_URL="file:./db/custom.db"` **نسبت به `prisma/schema.prisma`** حل می‌شود → یعنی `prisma/db/custom.db`، نه ریشه! اگر stats صفر برگرداند ولی `db/custom.db` پر است، مسیر اشتباه است:

```bash
# درست: از ریشهٔ prisma یک پله برو عقب
DATABASE_URL="file:../db/custom.db"

sqlite3 "file:db/custom.db?mode=ro" "SELECT COUNT(*) FROM Pamphlet;"   # ۱۴ = درست
curl -s localhost:3000/api/v1/stats                                     # pamphlets:14
```

### خطاهای رایج

| علامت | علت | حل |
|---|---|---|
| `EADDRINUSE :::3000` | سرور قبلی زنده است | `pkill -f next-server`؛ در بون گاهی SIGTERM کافی نیست → `kill -9` |
| login همیشه 401 با دادهٔ موجود | سرور به دیتابیس خالی وصل است | تلهٔ مسیر DB بالا |
| بلیت اتاق reject می‌شود | `AUTH_SECRET` دو سرویس یکی نیست | یکی‌شان کنید |
| `sqlitesyntaxerror` بعد از تغییر اسکیما | کلاینت قدیمی | `bun prisma generate` + ری‌استارت dev |
| lint خطای `set-state-in-effect` می‌دهد | قواعد سختگیرانهٔ React Compiler فعلی | شناخته‌شده — در P3 اصلاح می‌شود (فعلاً ۴ مورد) |

## قراردادهای کدنویسی

- فرانت: کامپوننت React + TypeScript، **RTL همیشه**، بدون استایل inline (BRAND.md §8)، فقط پالت برند (#DD614C و خانواده‌اش — **آبی/ایندیگو ممنوع**)
- بک: APIها زیر `/api/v1/*`، خطا `{error: "فارسی"}`، کوکی نشست `oeg_session`
- مالکیت فایل‌ها: `src/app/api/**` بک‌اند، `src/components/edu/*.tsx` ویوها، `src/lib/{constants,types,format,diff}.ts` مشترک — **دست نزنید**: `src/app/layout.tsx`, `globals.css`, `page.tsx` بدون هماهنگی
- برای تصمیم‌های فنی: اول [DECISIONS.md](DECISIONS.md) و [adr/](adr/) — واگرایی خاموش ممنوع

## عیب‌یابی — بخش تکمیلی: artifacts و پشتیبان

- **آرتیفکت‌های عیب‌یابی** در `.diag/` (gitignored) نگهداری می‌شوند — خروجی تست‌ها،
  گزارش‌های فازها، لاگ‌های CI. **`/tmp` ephemeral است** (tmpfs — با ریبوت پاک می‌شود؛
  در ریبوت 2026-11-01 همهٔ artifacts قبلی از دست رفت). هیچ چیز مهمی آنجا نگذارید.
- **باندل پشتیبان گیت:** `.diag/backup-YYYYMMDD.bundle` — پس از هر فاز بزرگ تازه‌سازی کنید:
  `git bundle create .diag/backup-$(date +%Y%m%d).bundle --all`
- **CI install:** node_modules از release asset `v0.3.0-deps` بازگردانی می‌شود
  ([ADR-0010](adr/0010-ci-install-reliability.md)) — بعد از هر تغییر `bun.lock`،
  artifact را محلی بازسازی و جایگزین کنید، وگرنه CI وابستگی‌های کهنه می‌بیند.

## مراجع

- [ARCHITECTURE.md](ARCHITECTURE.md) — معماری و ERD
- [CONTRIBUTING.md](CONTRIBUTING.md) — مشارکت (همهٔ نقش‌ها)
- [archive/2026-10-pre-reconciliation/worklog-legacy.md](archive/2026-10-pre-reconciliation/worklog-legacy.md) — قرارداد کامل API v1/v2
