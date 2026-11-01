# 🌿 GIT-STRATEGY.md — استراتژی گیت مُنت‌آموز

> مصوب: ADR-0008 (**GitHub Flow** — بازنگری 2026-10-30؛ نسخهٔ اول GitFlow بود). این سند قرارداد عملیاتی است.

## 1. مدل شاخه‌ها (GitHub Flow)

```
main ──► شاخهٔ کوتاه‌عمر (feature/fix/docs/chore) ──► Pull Request ──► merge (squash) ──► حذف شاخه
  ▲                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

- **`main`** — تنها شاخهٔ بلندمدت. محافظت‌شده: PR الزامی، force-push ممنوع، حذف ممنوع، **حتی برای مدیران** (enforce_admins).
- شاخه‌های کوتاه‌عمر از `main`: `feature/<slug>`، `fix/<slug>`، `docs/<slug>`، `chore/<slug>` — بعد از merge حذف می‌شوند.
- **هیچ `develop`ای نیست** (تک‌توسعه‌دهنده؛ سربار خالص). اگر تیم ≥۳ نفر شد → ADR جدید.

## 2. قالب پیام کامیت (Conventional Commits)

```
<type>(<scope>): <توضیح کوتاه فارسی یا انگلیسی>

[بدنه اختیاری: چرا و چه]
```

انواع مجاز: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

نمونه:
```
feat(wallet): افزودن سقف شارژ ۵ میلیون تومانی
fix(classroom): رفع قطع شدن تخته روی قطع‌ووصل شبکه
docs(adr): بازنگری ADR-0008 به GitHub Flow
```

- Subject ≤ ۷۲ کاراکتر، زمان حال، بدون نقطهٔ پایانی.
- Squash-merge یعنی هر PR = یک کامیت تمیز روی `main`.

## 3. قاعدهٔ پیام‌های «صدای انسانی» (بدون نام ابزار AI)

- `.githooks/commit-msg` (فعال با `core.hooksPath`) پیام‌های حاوی نام ابزار/مدل هوش مصنوعی را **رد می‌کند** (claude, chatgpt, openai, copilot, gemini, …).
- **چرا:** این پروژه ممکن است با کمک AI نوشته شود، اما کامیت‌ها با صدای انسانی و به نام نگهدارنده صحبت می‌کنند؛ تاریخچهٔ عمومی نباید تبلیغ ابزار باشد و پاسخ‌گویی به تغییرات با انسان است.
- **bypass اضطراری:** `git commit --no-verify` — بی‌توجه به هشدار، CI همان قانون را در `.github/workflows/commit-lint.yml` روی هر PR اجرا می‌کند و PR را رد می‌کند.
- تریلرهای `Co-Authored-By:` ارجاع به ربات/ایجنت هم ممنوع است (hook + CI).

## 4. فرایند Pull Request

1. از `main` شاخه بساز، کار کن، push کن.
2. PR با قالب [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) (چه/چرا/چک‌لیست).
3. ادغام: **squash** + حذف شاخه. فعلاً self-merge با ۰ approval مجاز است (سیاست: `required_approving_review_count: 0`؛ از P3 CI اجباری می‌شود).
4. `main` همیشه deployable فرض می‌شود — چیزی که تست نشده merge نکن.

## 5. فرایند انتشار

1. به‌روزرسانی `CHANGELOG.md` (Keep a Changelog) زیر `[Unreleased]`.
2. ویرایش نسخه و squash-merge نهایی به `main`.
3. تگ: `git tag -a v0.3.0 -m "…"` → `git push origin v0.3.0` (SemVer: MAJOR = شکستن API/مدل داده، MINOR = فاز/قابلیت، PATCH = رفع اشکال).

## 6. وضعیت Remote

```bash
git remote add origin git@github.com:MontAmooz/mont-amooz.git   # SSH — انجام شد (P2)
git push -u origin main
# محافظت main: PR الزامی، enforce_admins=true، force-push/حذف ممنوع (P2)
```

- مخزن قدیمی (پیش از بازسازی تاریخچه): `MontAmooz/mont-amooz-legacy` (private، حفظ‌شده به‌عنوان آرشیو).
- قرارداد کامل: [docs/adr/0008-gitflow-going-forward.md](adr/0008-gitflow-going-forward.md).
