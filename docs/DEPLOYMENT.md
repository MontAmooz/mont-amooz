# 🚢 DEPLOYMENT.md — طرح استقرار پروداکشن

> **وضعیت: سند طراحی — هنوز هیچ‌کدام پیاده نشده است.** فعلاً پروژه فقط لوکال اجرا می‌شود (`bun run dev`).
> هدف این سند این است که وقتی استقرار شروع شد، نقشه از قبل نوشته باشد.

## 1. وضعیت فعلی

- استقرار: **نداریم** — توسعهٔ لوکال روی WSL/Arch، دیتابیس SQLite فایل، پرداخت mock.
- نیازمندی واقعی استقرار: پس از e-namad و آماده‌شدن محتوای واقعی.

## 2. معماری هدف (طرح)

```
                    ┌────────────── VPS ایرانی (ArvanCloud / Asiatech) ──────────────┐
کاربر ── HTTPS ──►  │  Caddy (TLS خودکار Let's Encrypt، گیت‌وی)                       │
                    │    ├─ /            → app (Next.js standalone، Docker)          │
                    │    └─ /?XTransformPort=3003 → classroom (socket.io، Docker)    │
                    │  postgres:16 (volume + بکاپ روزانه pg_dump)                     │
                    │  minio (فایل جزوه‌ها/ویدیوها، volume)                            │
                    └────────────────────────────────────────────────────────────────┘
```

- میزبان: **VPS ایرانی** (تأخیر کم + انطباق مقرراتی) — ArvanCloud یا Asiatech.
- کنتینرها با **Docker Compose** (تک‌سرور)؛ Kubernetes برای بعد از رشد.
- دامنه + SSL با Caddy (Let's Encrypt خودکار).

## 3. Dockerfile (طرح — multi-stage، خروجی standalone)

```dockerfile
# ---- deps ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate && bun run build   # output: standalone

# ---- run ----
FROM oven/bun:1-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["bun", "server.js"]
```

(کلاس‌سرویس: Dockerfile سادهٔ دوم — `oven/bun:1` + `bun run start` روی :3003.)

## 4. docker-compose.yml (طرح)

```yaml
services:
  app:        # Next.js standalone
    build: .
    environment: [DATABASE_URL, AUTH_SECRET, NODE_ENV]
    depends_on: [postgres]
  classroom:  # socket.io
    build: ./mini-services/classroom-service
    environment: [AUTH_SECRET]
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
    # رمز فقط از secret/env — هرگز trust auth
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [miniodata:/data]
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddydata:/data]
volumes: { pgdata: {}, miniodata: {}, caddydata: {} }
```

## 5. بکاپ و بازیابی

- **pg_dump روزانه** (cron) → آپلود به MinIO با نگهداشت ۳۰ روز + یک کپی خارج از سرور.
- بازیابی: `pg_restore` روی دیتابیس خالی + تأیید با `/api/v1/stats`.
- **تست بازیابی ماهانه** الزامی است (بکاپی که تست نشده، بکاپ نیست).
- RTO هدف: < ۴ ساعت · RPO هدف: < ۲۴ ساعت (فعلاً روزانه کافی است).

## 6. سلامت و پایش

- Health: `GET /api/v1/stats` (HTTP 200) و `GET :3003/health` → `{"ok":true}`
- Caddy probe هر ۶۰ ثانیه؛ ری‌استارت خودکار کانتینر (`restart: unless-stopped`)
- بعداً: Sentry برای خطاها، Prometheus+Grafana برای متریک (چشم‌انداز DECISIONS v1)

## 7. چک‌لیست امنیتی پیش از عمومی‌شدن (از SECURITY.md و ADRها)

- [ ] `AUTH_SECRET` تصادفی ۳۲بایتی، فقط از secret store — نه fallback کد
- [ ] کوکی `secure: true` + HTTPS اجباری
- [ ] PostgreSQL: احراز هویت `scram-sha-256`، رمز قوی، بدون پورت عمومی
- [ ] MinIO: کلیدهای تصادفی، bucket policy حداقلی
- [ ] Rate limiting در Caddy
- [ ] حذف حساب‌های نمایشی و دادهٔ seed از پروداکشن
- [ ] `next.config.ts`: `typescript.ignoreBuildErrors: false`

### Cookie `secure` flag

`src/lib/server/auth.ts` sets `secure: false` for the session cookie. **This MUST flip to `true` before any HTTPS deployment.** It's a one-line change guarded by an environment variable. Until then, the platform is HTTP-only (dev/self-hosted).

When flipping:
1. Set `secure: true` in `auth.ts`
2. Ensure deployment uses HTTPS (Caddy/nginx auto-SSL)
3. Verify login works over HTTPS
4. Update any internal curl/API tests that assume HTTP

### Beta rate limits

`POST /api/v1/auth/register`: **10 per hour per IP** (raised from 3 for beta, because Iranian CGNAT commonly puts multiple users behind one IP).
`POST /api/v1/auth/login`: **20 per hour per IP** (raised from 10).

If you see mass 429s on beta launch, check `RateLimitAttempt` table:
```sql
SELECT key, COUNT(*) FROM RateLimitAttempt
WHERE createdAt > datetime('now', '-1 hour')
GROUP BY key ORDER BY COUNT(*) DESC LIMIT 10;
```

### `/tmp` hazard on the dev/test machine

The ephemeral test servers and CI artifact tarballs live in `/tmp` (tmpfs). If integration tests answer mysterious HTML 404s on dynamic routes while CI is green, `/tmp` is probably full — see [DEVELOPMENT.md § `/tmp` Disk Exhaustion](DEVELOPMENT.md#️-tmp-disk-exhaustion--the-silent-test-killer).

## 8. ترتیب اجرا (وقتی نوبتش رسید)

1. Dockerfile + compose محلی تا همین‌جا کار کند (SQLite می‌ماند)
2. مهاجرت PostgreSQL (P4 — ADR-0002) و MinIO (P5 — ADR-0007)
3. VPS + Caddy + دامنه + SSL
4. بکاپ خودکار + تست بازیابی
5. Zarinpal واقعی (P10) → سپس افتتاح عمومی پرداخت‌دار
