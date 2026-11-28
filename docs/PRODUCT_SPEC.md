# docs/PRODUCT_SPEC.md — Product Specification (implemented vs planned)

> Created 2026-11-28 (task `META-DOC-BOOTSTRAP-RECOVERY`). Product vision & phase plan: [`docs/ROADMAP.md`](ROADMAP.md). Execution state: [`PROJECT_STATUS.md`](../PROJECT_STATUS.md). Evidence basis: Git history (45 commits to `#23`), test suite inventory, `prisma/schema.prisma` (30 models), CI status. Status labels per the current-state audit in `PROJECT_STATUS.md` / `docs/ROADMAP_RECOVERY.md`.

**Legend:** `IMPLEMENTED_VERIFIED` = code + automated tests + acceptance evidence (CI/stage gate) · `IMPLEMENTED_UNVERIFIED` = code present, no test evidence found · `PARTIAL` · `NEEDS_VERIFICATION` · `MISSING` = not present in the repository.

---

## 1. Implemented Capabilities

| # | Capability | Status | Key evidence |
|---|---|---|---|
| 1 | Auth — register/login/logout/me, scrypt hashes, HMAC-SHA256 session cookie (7d) | IMPLEMENTED_VERIFIED | `src/app/api/v1/auth/*`, ADR-0004, `tests/integration/auth.test.ts`, `tests/e2e/auth.spec.ts` |
| 2 | Auth hardening — IP rate limits, admin panel, password reset + change, session refresh | IMPLEMENTED_VERIFIED | `P10` (`#12`), `tests/integration/{rate-limit,password-change,admin}.test.ts`, `tests/e2e/{auth-hardening,admin-reset}.spec.ts` |
| 3 | Pamphlet Hub — CRUD, Persian taxonomy, Markdown-in-DB content, fork lineage, merge requests + diff review, version history, Persian-normalized search (LIKE) | IMPLEMENTED_VERIFIED | `src/app/api/v1/{pamphlets,merge-requests}`, ADR-0007, `tests/integration/{pamphlets,fork-and-mr}.test.ts`, `tests/e2e/{pamphlet-create,pamphlet-detail,fork-mr}.spec.ts` |
| 4 | Community review — ratings, helpful votes, contribution attribution | IMPLEMENTED_VERIFIED | `tests/integration/reviews.test.ts`, `tests/e2e/reviews.spec.ts` |
| 5 | Pamphlet Q&A threads (single-level replies) | IMPLEMENTED_VERIFIED | `P19` (`#21`), `PamphletComment` model, `tests/integration/pamphlet-comments.test.ts`, `tests/e2e/pamphlet-qa.spec.ts` |
| 6 | PDF/Word attachments — upload, download, HTML preview (mammoth/pdf-parse, file-type sniffing) | IMPLEMENTED_VERIFIED | `P9` (`#11`), ADR-0012, `src/app/api/v1/attachments/*`, `tests/integration/{attachments,attachments-html}.test.ts`, `tests/e2e/attachments.spec.ts` |
| 7 | Wallet & mock payments — deposit/verify/withdraw («پرداخت‌یار» mock gateway), Txn ledger | IMPLEMENTED_VERIFIED | ADR-0005, `src/app/api/v1/wallet/*`, `tests/integration/wallet.test.ts`, `tests/e2e/wallet.spec.ts` |
| 8 | Teaching marketplace — teacher discovery, slots booking, session lifecycle + cancel/complete/join | IMPLEMENTED_VERIFIED | `src/app/api/v1/{market,slots,sessions}`, `tests/integration/{slots,sessions}.test.ts`, `tests/e2e/market-booking.spec.ts` |
| 9 | Live classroom — socket.io mini-service (:3003), chat + collaborative whiteboard + presence, HMAC room tickets, Caddy `?XTransformPort` gateway | IMPLEMENTED_VERIFIED | ADR-0006, `mini-services/classroom-service/`, `tests/e2e/{classroom,gateway}.spec.ts` |
| 10 | Video courses — catalog, purchase with wallet, locked lessons, watch progress, course reviews | IMPLEMENTED_VERIFIED | `src/app/api/v1/courses/*`, `tests/integration/courses.test.ts`, `tests/e2e/courses.spec.ts` |
| 11 | In-app notifications — 6 trigger events, read/unread, unread-count | IMPLEMENTED_VERIFIED | `P11` (`#13`), `src/app/api/v1/notifications/*`, `tests/integration/{notifications-api,notification-triggers}.test.ts`, `tests/e2e/notifications.spec.ts` |
| 12 | Exam builder — MC + essay questions, timer, attempts (start/submit), auto- + manual grading | IMPLEMENTED_VERIFIED | `P12` (`#14`) + `P14` (`#16`), `src/app/api/v1/exams/*`, `tests/integration/{exams-crud,exam-attempts}.test.ts`, `tests/e2e/exams.spec.ts` (known flake class — see `docs/TESTING.md §3`) |
| 13 | Interactive lessons — step engine (TEXT/MC/NUMERIC/FILL_BLANK/IMAGE), branching, step images, per-step progress, first-try stats | IMPLEMENTED_VERIFIED | `P15` (`#17`) + `P21` (`#23`), `src/app/api/v1/interactive-lessons/*`, `step-images/*`, `tests/integration/interactive-lessons.test.ts`, `tests/e2e/{lessons,interactive-polish}.spec.ts` |
| 14 | Teacher experience — analytics, Word preview, related pamphlets | IMPLEMENTED_VERIFIED | `P17` (`#19`), `tests/integration/{teacher-analytics,related-pamphlets}.test.ts`, `tests/e2e/teacher-experience.spec.ts` |
| 15 | Student dashboard `#/my-learning` — summary cards, progress views | IMPLEMENTED_VERIFIED | `P18` (`#20`), `tests/integration/student-dashboard.test.ts`, `tests/e2e/student-dashboard.spec.ts` |
| 16 | Moderation — user reports, hide/suspend, admin dashboard, admin password reset | IMPLEMENTED_VERIFIED | `P20` (`#22`), `Report` model, `src/app/api/v1/{admin,reports}`, `tests/integration/{reports,admin}.test.ts`, `tests/e2e/moderation.spec.ts` |
| 17 | Welcome flow for new users | IMPLEMENTED_VERIFIED | `P16` (`#18`), `tests/e2e/welcome.spec.ts` |
| 18 | Seed content (demo users/pamphlets/exams/lessons) + seed-integrity test | IMPLEMENTED_VERIFIED | `P13` (`#15`), `prisma/seed.ts`, `tests/integration/seed-integrity.test.ts` |
| 19 | Mobile-responsive RTL SPA shell (hash routing) | IMPLEMENTED_VERIFIED | `tests/e2e/mobile.spec.ts`, `src/app/page.tsx` |
| 20 | CI — lint/type/test/e2e/secret-scan/commit-lint on PR; node_modules artifact pattern | IMPLEMENTED_VERIFIED | ADR-0010, `.github/workflows/*` |
| 21 | Live WebSocket gateway routing (Caddy dev gateway, optional) | NEEDS_VERIFICATION | `Caddyfile` present; gateway e2e exists (`tests/e2e/gateway.spec.ts`) but the Caddy service itself is optional/local — no deployment evidence |

No feature was found with code but zero test coverage at the route level (`IMPLEMENTED_UNVERIFIED`: none identified).

## 2. Planned but NOT Implemented (no IDs minted — proposals live in `PROJECT_STATUS.md §E`)

| # | Capability | Status | Source of the plan |
|---|---|---|---|
| 1 | PostgreSQL 16 migration + Persian FTS engine | MISSING | ADR-0002; `docs/ARCHITECTURE.md §9` (planned migration never executed — see `docs/ROADMAP_RECOVERY.md §7.1`) |
| 2 | JWT (access + refresh) sessions | MISSING | ADR-0004 plan-backreference |
| 3 | Real payment gateway (Zarinpal, webhook flow) | MISSING | ADR-0005; mock only today |
| 4 | WebRTC audio/video in live classroom (+ recording) | MISSING | ADR-0006; classroom is chat+board only (disclosure required per ROADMAP `P11` note) |
| 5 | MinIO / object storage for large files & video | MISSING | ADR-0007 plan; attachments currently local-disk (ADR-0012) |
| 6 | Production deployment (Docker, Caddy TLS, VPS, backups) | PARTIAL — design doc only, nothing deployed | `docs/DEPLOYMENT.md` (explicitly "طرح — پیاده نشده") |
| 7 | Error monitoring (Sentry) + metrics | MISSING | `docs/ROADMAP.md` hardening list (planned as its "P8") |
| 8 | Compliance: e-namad, ToS, privacy policy, commission legal framework | MISSING | `docs/ROADMAP.md` compliance section |
| 9 | AI study assistant + AI advisory (Phase 4) | MISSING | `docs/ROADMAP.md` فاز ۴ |
| 10 | Content marketplace completion: video CDN/HLS, invoicing | MISSING | `docs/ROADMAP.md` فاز ۲ technical remainder |

## 3. Explicit Non-Goals (current)

From `docs/ARCHITECTURE.md §10` (note: "no admin panel" listed there is **stale** — item 16 above shipped): no AI features (Phase 4), no mobile app, no email notifications, no dedicated FTS engine (until after PostgreSQL). Additionally: no history rewriting of the public repository (project policy, `docs/ROADMAP_RECOVERY.md §9.6`).
