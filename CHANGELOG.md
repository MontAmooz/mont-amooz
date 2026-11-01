# Changelog — مُنت‌آموز

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Dates before 2026-10-30 are derived from file/git metadata (no dated entries exist in the legacy worklog).

## [Unreleased]

### Planned (see docs/ROADMAP.md)
- Production hardening (P3–P9): tests, CI, GitFlow/remote setup, PostgreSQL, MinIO, JWT, Zarinpal, WebRTC
- Phase 3: Exam Builder; Phase 4: AI + Advisory

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

[Unreleased]: https://example.invalid/compare/v0.2.0...HEAD
[0.2.0]: https://example.invalid/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/compare/v0.0.1...v0.1.0
[0.0.1]: https://example.invalid/releases/v0.0.1
