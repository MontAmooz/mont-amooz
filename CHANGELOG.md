# Changelog — مُنت‌آموز

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Dates before 2026-10-30 are derived from file/git metadata (no dated entries exist in the legacy worklog).

## [Unreleased]

### Pending decisions (ADR-0014 — planned-numbering divergence)
- Execute-or-retire the never-executed planned migrations: PostgreSQL (ADR-0002), MinIO (ADR-0007), JWT (ADR-0004), Zarinpal (ADR-0005), WebRTC (ADR-0006), external FTS, Sentry, production deployment (`PROJECT_STATUS.md §E.3`)
- Phase 3: substantially covered (P12/P14/P15/P17/P18/P21); Phase 4: AI + Advisory (not started); compliance workstream (e-namad, ToS, privacy) before public paid launch

## [0.3.0] — 2026-11-28 — Operational Evolutions & Health Gate (P7–P22)

### Operational Evolutions (P7–P21)
- **Quality infrastructure (P7–P8):** API integration tests across all endpoints (+130 tests, `#8`); browser E2E suite for the critical flows (38 scenarios, `#9`/`#10`)
- **Content & classroom (P9/P13/P19):** PDF/Word pamphlet attachments with preview (ADR-0012, `#11`); seed expansion + landing polish (`#15`); pamphlet Q&A threads (`#21`)
- **Platform hardening (P10/P11/P16):** auth hardening — rate limits, admin panel, password reset, session refresh (`#12`); in-app notifications, 6 trigger events (`#13`); beta-readiness — raised limits, welcome flow, admin notify, `/tmp` guard (`#18`)
- **Assessment (P12/P14):** Exam Builder MVP — multiple-choice exams, attempts, auto-grading (`#14`); essay exams, timer, manual grading (`#16`)
- **Interactive learning (P15/P17/P18/P21):** Interactive Learning MVP — TEXT/MC/NUMERIC steps (`#17`); teacher experience — Word preview, analytics, discovery (`#19`); student dashboard `#/my-learning` (`#20`); interactive polish — FILL_BLANK, IMAGE, BRANCHING (`#23`)
- **Moderation (P20):** admin moderation toolkit — reports, hide, suspend, dashboard (`#22`)

### Health Gate (P22)
- Contributor identity policy + CI hygiene gate (ADR-0013, `#24`): canonical maintainer identity, GitHub web-flow allowlist, `.mailmap` display unification (no history rewrite), identity check wired into CI

### Documentation (P23)
- Stale-docs reconciliation: session-cookie name corrected to `ma_session` across active docs; admin panel removed from the non-goals list; Prisma model map updated to 30 models (P10/P19/P20 included); legacy agent-instruction file archived — `AGENTS.md` is now the single agent-instructions file; ADR-0014 records the stage-numbering convention

## [0.2.0] — 2026-10-21 — Phase 2: Workshop (کارگاه تدریس)

### Added
- **Wallet & payments (mock):** `Wallet`/`Txn` models; deposit → PENDING → mock gateway dialog («پرداخت‌یار») → verify → credit; withdraw with limits (constants: 10k–5M Toman deposit, 50k min withdraw)
- **Teaching marketplace:** teacher discovery by rating/price/session count; commission split 20% platform / 80% teacher
- **Slots & sessions:** `TeacherSlot` booking flow, `ClassSession` lifecycle (BOOKED/COMPLETED/CANCELLED_*), cancellation policy (≥2h → full refund)
- **Video courses:** `VideoCourse`/`VideoLesson`/`CourseEnrollment`/`LessonProgress`; purchase with wallet; locked-lesson gating; learn/player views
- **Live classroom (mini-service):** `mini-services/classroom-service` — socket.io on :3003, chat relay + collaborative whiteboard (stroke/clear/undo) + presence, HMAC room tickets, snapshot cap 800 strokes; reached via Caddy `/?XTransformPort=3003`
- Persian (RTL) UI for all Phase 2 views: market, book, sessions, courses, learn, teach, wallet, classroom

## [0.1.0] — 2026-10-20 — Phase 1: Pamphlet Hub (کتابخانهٔ جزوه‌ها)

### Added
- **Auth:** email+password, scrypt hashing, HMAC-SHA256 session token in httpOnly cookie `oeg_session` (7-day expiry); register/login/logout/me
- **Pamphlets:** CRUD with Persian taxonomy (grades 7–12, 14 subjects, 6 teaching methods, 3 difficulties); Markdown content stored in DB; Persian-normalized search (LIKE)
- **Git-inspired collaboration:** fork (کپی و بهبود, name suffixed «(فورک)»), merge requests with line diff + review flow (OPEN/MERGED/REJECTED), version history (`PamphletVersion`)
- **Community review:** ratings (1–5) with helpful/unhelpful votes; contribution (intellectual-property %) model from merge history
- SPA with hash routing (`#/pamphlet/{id}`, …), Zustand session store, RTL-first brutalist UI (Vazirmatn, #DD614C)

## [0.0.1] — 2026-06-22 — Initial scaffold

### Added
- Planning documents: vision README, BRAND, ROADMAP, ARCHITECTURE, DECISIONS v1 (2026-06-19), CONTRIBUTING, DEVELOPMENT
- Next.js 16 App Router scaffold with TypeScript + Tailwind + Prisma; SQLite dev database; seed with 7 demo users (6 teachers + 1 student)

[Unreleased]: https://example.invalid/compare/v0.3.0...HEAD
[0.3.0]: https://example.invalid/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/compare/v0.0.1...v0.1.0
[0.0.1]: https://example.invalid/releases/v0.0.1
