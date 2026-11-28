# PROJECT STATUS

> **This file is the single source of truth for execution state.** Evidence appendix: `docs/ROADMAP_RECOVERY.md`. Workflow rules: `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md`. Doc responsibilities: `PROJECT_DOCUMENTATION_GUIDE.md`.
> Created 2026-11-28 by task `META-DOC-BOOTSTRAP-RECOVERY`. All changes from that task were left **uncommitted** by that task's constraint (no commit/push) and were committed on 2026-11-28 via task `P22` (PR `#24`).

## A. Project Overview

| Field | Value |
|---|---|
| Name | مُنت‌آموز / MontAmooz (formerly OpenEduGit; renamed in stage `P6`) |
| Purpose | Persian/RTL, Git-inspired collaborative platform for Iranian school handouts (pamphlets), evolving into a teaching marketplace + interactive learning platform |
| Main goal | Free, community-curated layer of supplementary educational content; revenue from services (classes/courses), core stays free (AGPLv3 / CC BY-SA 4.0) |
| Tech stack (from manifests only) | Next.js ^16.1.1 (App Router, Turbopack, standalone) · React ^19 · TypeScript ^5 · Tailwind CSS ^4 · Prisma ^6.11.1 + SQLite (`db/custom.db`) · HMAC-SHA256 session cookie · socket.io 4.8 mini-service (`mini-services/classroom-service`, :3003) · Bun ≥1.3 / Node ≥20 · Vitest ^5 + Playwright 1.64.1 |
| Repository path | `/home/mompateji/GitM0nt/open-edu-git` |
| Remote | `git@github.com:MontAmooz/mont-amooz.git` (branch `main`, protected: PR + required checks) |
| Last Updated | 2026-11-28 |

## B. Current State

- **Stage:** post-`P22` — all recorded prompt-stages `P2b`→`P21` executed and accepted; `P22` (hygiene decisions + CI wiring) accepted 2026-11-28.
- **Last Accepted Task:** `P22` (contributor identity policy + CI hygiene gate — ADR-0013; PR `#24`, merged 2026-11-28). Evidence: `.diag/74-p22-local.txt` (local gate) / `.diag/75-p22-verify.txt` (post-merge). Test baselines unchanged from `P21` (docs/script scope only, no spec changes): vitest **500 passed**, e2e **79 scenarios**; required checks on the PR: `["scan","quality","test","e2e","hygiene"]` green; CI artifact `node_modules-ci.tgz` (394,662,089 B) refreshed 2026-11-28T09:41:56Z (no lockfile/schema change — not rebuilt).
- **Active Tasks:** none.
- **Blocked Tasks:** none — §J hygiene decisions resolved 2026-11-28 (ADR-0013); Hygiene Gate green.
- **Pending Reviews:** none recorded.
- **Next stage ID:** `P23` — first product task of the post-hygiene phase; **not yet scoped** (minting is an orchestrator decision, protocol §6; candidate list §E).

## C. HISTORICAL ROADMAP

> Only referenced evidence. Full per-stage table with evidence sources and confidence: `docs/ROADMAP_RECOVERY.md §4`.

| Stage ID | Output | Date | Confidence | Accepted via |
|---|---|---|---|---|
| `P1` | scope unrecoverable (pre-public era) | ≤2026-10-30 | LOW | — |
| `P2b` | `#1` GitHub Flow docs/hook/templates + `#2` code-quality foundation | 2026-10-30 | MEDIUM | ADR-0008, CI |
| `P3` | `#3` Vitest foundation (tag `v0.3.0-deps`) | 2026-11-01 | HIGH | ADR-0009, CI, tag |
| `P4` | `#5` CI diagnostic + `#6` ADR-0010 artifact pattern, persistent `.diag` | 2026-11-01 | MEDIUM | ADR-0010, CI |
| `P5` | verify-only gate (no merged output) | 2026-11-01 | MEDIUM | `.diag/28` |
| `P6` | `#7` rename to مُنت‌آموز / MontAmooz | 2026-11-01 | HIGH | ADR-0011, `.diag/30` |
| `P7` | `#8` integration tests for all API endpoints (+130) | 2026-11-02 | HIGH | `.diag/32` |
| `P8` | `#9` Playwright e2e (38 scenarios) + `#10` title fix | 2026-11-12 | HIGH | `.diag/34` |
| `P9` | `#11` PDF/Word attachments (ADR-0012) | 2026-11-13 | HIGH | ADR-0012, `.diag/37` |
| `P10` | `#12` auth hardening (rate limits, admin panel, password reset, session refresh) | 2026-11-14 | MEDIUM | `.diag/38-41` |
| `P11` | `#13` in-app notifications (6 events) | 2026-11-14 | MEDIUM | `.diag/41-44` |
| `P12` | `#14` Exam Builder MVP (MC, attempts, auto-grading) | 2026-11-17 | HIGH | `.diag/44-47` |
| `P13` | `#15` seed expansion + landing polish | 2026-11-17 | HIGH | `.diag/47-49` |
| `P14` | `#16` essay exams, timer, manual grading | 2026-11-19 | HIGH | `.diag/50-52` |
| `P15` | `#17` Interactive Learning MVP (TEXT/MC/NUMERIC) | 2026-11-19 | HIGH | `.diag/53-55` |
| `P16` | `#18` beta-readiness (rate-limit raise, welcome flow, admin notify, /tmp guard) | 2026-11-20 | HIGH | `.diag/56-58` |
| `P17` | `#19` Word preview, teacher analytics, discovery | 2026-11-21 | HIGH | `.diag/59-61` |
| `P18` | `#20` student learning dashboard `#/my-learning` | 2026-11-21 | HIGH | `.diag/62-64` |
| `P19` | `#21` pamphlet Q&A threads | 2026-11-21 | HIGH | `.diag/65-67` |
| `P20` | `#22` admin moderation toolkit (reports, hide, suspend, dashboard) | 2026-11-22 | HIGH | `.diag/68-70` |
| `P21` | `#23` interactive polish (FILL_BLANK, IMAGE, BRANCHING) | 2026-11-28 | HIGH | `.diag/71-73` |

Product-level phases (`docs/ROADMAP.md`): فاز ۱ ✅ (v0.1.0) · فاز ۲ ✅ (v0.2.0) · فاز ۳ 🚧 (substantially covered by `P12`/`P14`/`P15`/`P17`/`P18`/`P21`) · فاز ۴ 🔮 (not started). **Known conflict:** the `P4`–`P9` scopes *planned* in `docs/ROADMAP.md` were never executed under those numbers — the executed series reused the IDs with different scopes (`docs/ROADMAP_RECOVERY.md §7.1`). No "Wave" identifiers exist anywhere.

## D. NON-RECOVERABLE

- Stages before `P1` / any `P0`–`P2a` identifiers, and the full scope of `P1` and `P5` — artifacts destroyed by the 2026-11-01 tmpfs wipe (recorded in `.diag/26-p4-merged.txt`); possibly archived in the private legacy repo (`mont-amooz-legacy`), not inspectable from here.
- Any planned roadmap beyond `P21` — no repo-resident evidence.
- "Wave"-named plan items — zero occurrences in the repository.
- The original planning conversation — only its document shadow survives (`docs/archive/2026-10-pre-reconciliation/`).

## E. PROPOSED ROADMAP

> Candidates only — no historical IDs, no status. Enter §C only after human approval. Rationale: `docs/ROADMAP_RECOVERY.md §8`.

1. Hygiene decisions + CI wiring (§J) — gates everything else. → **Approved and executed as `P22` (2026-11-28, ADR-0013); see §F.**
2. Stale-docs reconciliation batch (CHANGELOG 0.2.1+/P7–P21; ARCHITECTURE cookie/admin/models; cookie name in GIT-STRATEGY/DEVELOPMENT; ADR count in docs/README; CLAUDE.md disposition).
3. Execute-or-retire the never-executed planned migrations: PostgreSQL (ADR-0002), MinIO (ADR-0007), JWT (ADR-0004), Zarinpal (ADR-0005), WebRTC (ADR-0006), external FTS, Sentry, production deployment (`docs/DEPLOYMENT.md` is a design doc).
4. Compliance workstream (e-namad, ToS, privacy) before public paid launch.
5. Decide numbering convention for future stages (proposal: continue `P22+`; record the executed-vs-planned divergence in an ADR).

## F. Task Registry

> Status lifecycle and rules: `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md`. `Docs Updated = n/a (pre-protocol)` — the Documentation Step became mandatory with this bootstrap task. "Assigned" is intentionally the maintainer identity per the Contributor Identity Rule; no agent names are recorded.

| ID | Title | Status | Priority | Dependencies | Evidence | Acceptance Criteria (recorded) | Assigned | Related Files | Docs Updated | Updated At |
|---|---|---|---|---|---|---|---|---|---|---|
| baseline | initial public release — Phase 1+2 MVP (`b20c924`) | ACCEPTED | — | — | commit `b20c924`, CHANGELOG v0.1.0/v0.2.0 | Phase 1+2 MVP on `main` | maintainer | `src/**`, `prisma/**` | n/a (pre-protocol) | 2026-10-30 |
| P2b | GitHub Flow foundation | ACCEPTED | — | baseline | PR `#1`/`#2`, ADR-0008 | hooks+templates+0 lint/0 tsc CI | maintainer | `.githooks/`, `.github/`, `eslint.config.mjs` | n/a (pre-protocol) | 2026-10-30 |
| P3 | Vitest foundation | ACCEPTED | — | P2b | PR `#3`, tag `v0.3.0-deps`, ADR-0009 | unit+integration suite, CI test job | maintainer | `tests/`, `vitest.config.ts` | n/a (pre-protocol) | 2026-11-01 |
| P4 | CI install reliability (artifact pattern) | ACCEPTED | — | P3 | PR `#5`,`#6`, ADR-0010 | required checks stable; `.diag` persistent | maintainer | `.github/workflows/`, `.diag/` | n/a (pre-protocol) | 2026-11-01 |
| P5 | gate-only stage | ACCEPTED | — | P4 | `.diag/28-p5-verify.txt` | CI health green; no output merged | maintainer | — | n/a (pre-protocol) | 2026-11-01 |
| P6 | rename to مُنت‌آموز / MontAmooz | ACCEPTED | — | P4 | PR `#7`, ADR-0011, `.diag/30` | rename integrity (login 200/401, cookie) | maintainer | repo-wide rename | n/a (pre-protocol) | 2026-11-01 |
| P7 | API integration tests (all endpoints) | ACCEPTED | — | P6 | PR `#8`, `.diag/32` | 211 tests green; CI green | maintainer | `tests/integration/` | n/a (pre-protocol) | 2026-11-02 |
| P8 | Playwright E2E (critical flows) | ACCEPTED | — | P7 | PR `#9`,`#10`, `.diag/34` | 38 e2e scenarios; CI green | maintainer | `tests/e2e/`, `playwright.config.ts` | n/a (pre-protocol) | 2026-11-12 |
| P9 | pamphlet attachments (PDF/Word) | ACCEPTED | — | P8 | PR `#11`, ADR-0012, `.diag/37` | upload/download/preview; 243 tests | maintainer | `src/app/api/v1/attachments/`, `src/lib/server/storage.ts` | n/a (pre-protocol) | 2026-11-13 |
| P10 | auth hardening | ACCEPTED | — | P9 | PR `#12`, `.diag/38-41` | rate limits, admin panel, reset flow; schema+artifact refresh | maintainer | `src/app/api/v1/auth/`, `src/app/api/v1/admin/` | n/a (pre-protocol) | 2026-11-14 |
| P11 | notifications | ACCEPTED | — | P10 | PR `#13`, `.diag/41-44` | 6 trigger events; unread count; e2e | maintainer | `src/app/api/v1/notifications/` | n/a (pre-protocol) | 2026-11-14 |
| P12 | Exam Builder MVP | ACCEPTED | — | P11 | PR `#14`, `.diag/44-47` | teacher MC exams; attempts; auto-grade | maintainer | `src/app/api/v1/exams/` | n/a (pre-protocol) | 2026-11-17 |
| P13 | seed expansion + landing polish | ACCEPTED | — | P12 | PR `#15`, `.diag/47-49` | pamphlets|40 seed; landing polish | maintainer | `prisma/seed.ts` | n/a (pre-protocol) | 2026-11-17 |
| P14 | essay exams + timer + manual grading | ACCEPTED | — | P13 | PR `#16`, `.diag/50-52` | start/submit/grade API; timer | maintainer | `src/app/api/v1/exams/` | n/a (pre-protocol) | 2026-11-19 |
| P15 | Interactive Learning MVP | ACCEPTED | — | P14 | PR `#17`, `.diag/53-55` | TEXT/MC/NUMERIC steps; advance API | maintainer | `src/app/api/v1/interactive-lessons/` | n/a (pre-protocol) | 2026-11-19 |
| P16 | beta-readiness | ACCEPTED | — | P15 | PR `#18`, `.diag/56-58` | limits 20/10 per hour; welcome flow; /tmp guard | maintainer | auth routes, `tests/e2e/infra.ts` | n/a (pre-protocol) | 2026-11-20 |
| P17 | teacher experience (Word preview, analytics, discovery) | ACCEPTED | — | P16 | PR `#19`, `.diag/59-61` | analytics API; related pamphlets; preview | maintainer | `src/app/api/v1/users/me/analytics`, `attachments/[id]/html` | n/a (pre-protocol) | 2026-11-21 |
| P18 | student dashboard `#/my-learning` | ACCEPTED | — | P17 | PR `#20`, `.diag/62-64` | 4 summary cards; progress views | maintainer | `src/app/api/v1/users/me/dashboard` | n/a (pre-protocol) | 2026-11-21 |
| P19 | pamphlet Q&A threads | ACCEPTED | — | P18 | PR `#21`, `.diag/65-67` | single-level replies; schema+artifact refresh | maintainer | `src/app/api/v1/pamphlets/[id]/comments` | n/a (pre-protocol) | 2026-11-21 |
| P20 | admin moderation toolkit | ACCEPTED | — | P19 | PR `#22`, `.diag/68-70` | reports/hide/suspend/admin dashboard | maintainer | `src/app/api/v1/admin/`, `src/app/api/v1/reports` | n/a (pre-protocol) | 2026-11-22 |
| P21 | interactive polish (FILL_BLANK, IMAGE, BRANCHING) | ACCEPTED | — | P20 | PR `#23`, `.diag/71-73` | vitest 500 / e2e 79; checks green; artifact 2026-11-28T09:41:56Z | maintainer | `src/app/api/v1/interactive-lessons/`, `step-images/` | n/a (pre-protocol) | 2026-11-28 |
| P22 | contributor identity policy + CI hygiene gate | ACCEPTED | — | P21 (hygiene decisions §9.6) | PR `#24`, ADR-0013, `.diag/74-75` | script exit 0 over full history; CI job `hygiene` green on the PR; lint 0 / vitest 500 (no regressions); `.mailmap` display unification, no history rewrite | maintainer | `scripts/check-contributors.sh`, `.mailmap`, `.github/workflows/hygiene.yml`, `docs/adr/0013-*` | `PROJECT_STATUS.md`, `docs/TESTING.md` §4, `docs/ROADMAP_RECOVERY.md` §9, `docs/DECISIONS.md`, `AGENTS.md`, `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md` | 2026-11-28 |

## G. Parallel Execution Registry

| Group ID | Tasks | Agent | Branch | Worktree | Scope | Shared Contracts | Merge Status |
|---|---|---|---|---|---|---|---|
| (none observed) | — | — | — | — | All recorded stages ran **serially** — one branch at a time, squash-merged to protected `main` | n/a | n/a |

No parallel groups are recoverable from history; if parallel execution is adopted later, register groups here per the protocol's parallel-execution rules.

## H. Important Decisions

Authoritative index: [`docs/DECISIONS.md`](docs/DECISIONS.md) → ADR files [`docs/adr/`](docs/adr/).

| ADR | Decision | Status |
|---|---|---|
| 0001 | Next.js 16 instead of FastAPI | ACCEPTED |
| 0002 | SQLite for dev, PostgreSQL for production (migration **not yet executed**) | ACCEPTED |
| 0003 | Prisma 6 as ORM | ACCEPTED |
| 0004 | HMAC cookie sessions (JWT migration **not yet executed**) | ACCEPTED |
| 0005 | mock payment gateway until e-namad (Zarinpal **not yet executed**) | ACCEPTED |
| 0006 | live classroom: chat + whiteboard, no WebRTC yet | ACCEPTED |
| 0007 | pamphlet content: Markdown in DB (superseded in part by 0012) | ACCEPTED |
| 0008 | GitHub Flow + Conventional Commits | ACCEPTED |
| 0009 | testing strategy: Vitest + Playwright | ACCEPTED |
| 0010 | CI: node_modules as release artifact (sanction egress) | ACCEPTED |
| 0011 | project rename to مُنت‌آموز / MontAmooz | ACCEPTED |
| 0012 | PDF/Word pamphlet attachments (supersedes 0007) | ACCEPTED |
| 0013 | contributor identity & web-flow policy (canonical string, web-flow allowlist, `zwork` + `.mailmap`) | ACCEPTED |

> Note: ADR "migration at Pn" backreferences point at the *planned* numbering that was never executed under those IDs — see `docs/ROADMAP_RECOVERY.md §7.1`.

## I. Known Issues and Risks

1. **Hygiene gate** — **RESOLVED 2026-11-28** (`P22` / ADR-0013): canonical identity decided, web-flow pair allowlisted, `zwork <zwork@local>` accepted + `.mailmap` (display only, no history rewrite), `check-contributors.sh` exits 0 over the full history, CI job `hygiene` wired (`.github/workflows/hygiene.yml`).
2. **Cookie `secure:false`** (`src/lib/server/auth.ts`) — must flip to `true` before any HTTPS deployment (`docs/DEPLOYMENT.md` §7).
3. **`/tmp` exhaustion class** — test flake root cause documented in `docs/DEVELOPMENT.md` (tmpfs; check `df -h /tmp`, delete CI tarball after upload).
4. **E2E flake class** — full-run compile-race 404s on dynamic routes (e.g., `exams.spec` submit; documented in `.diag/71-p21-preflight.txt` and `tests/e2e/infra.ts:318`); solo reruns pass.
5. **CI artifact dependency** (`v0.3.0-deps` node_modules tarball, ADR-0010) — must be rebuilt after every `bun.lock`/schema change; uploads are slow on throttled egress; repo-local `.diag` bundles are the offline backup.
6. **Stale docs** (CHANGELOG, ARCHITECTURE, GIT-STRATEGY/DEVELOPMENT cookie name, docs/README ADR count, CLAUDE.md) — see `docs/ROADMAP_RECOVERY.md §7`.
7. **CHANGELOG/tag drift** — `package.json` 0.2.1 vs CHANGELOG 0.2.0 vs single tag `v0.3.0-deps` (artifact tag, not a release tag).
8. **`z-ai-web-dev-sdk` dependency present but unused** (grep over `src/`, `mini-services/`) — removal is a code change, pending human decision.
9. **Database path gotcha** — `DATABASE_URL` resolves relative to `prisma/schema.prisma` (`docs/DEVELOPMENT.md`).
10. **Legacy repo** (`mont-amooz-legacy`, private) holds pre-reconstruction history — relevant to any future history decisions.

## J. Contributor Hygiene Status — GREEN (resolved 2026-11-28)

- **Decisions recorded (ADR-0013, maintainer approval 2026-11-28):** canonical identity `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>`; web-flow pair `M0nt <67793307+montajebii@users.noreply.github.com>` + `GitHub <noreply@github.com>` allowlisted as valid squash-merge artifacts; `zwork <zwork@local>` accepted as historical and unified for display via `.mailmap`. **No history rewriting performed or permitted** — SHAs, dates and author/committer data verified untouched.
- **Audit result (2026-11-28):** 45 commits scanned; all four identity classes are now allowlisted (full audit tables remain in `docs/ROADMAP_RECOVERY.md §9`). No agent/tool names in any commit message or document credit.
- **Hygiene tests:** contributor check `scripts/check-contributors.sh` — **PASS (exit 0)** over the full history (exact whole-line allowlist per ADR-0013; current output in `docs/TESTING.md §4.1`). Text hygiene unchanged: `.githooks/commit-msg` (active via `core.hooksPath=.githooks`) + `.github/workflows/commit-lint.yml` — effective; commit messages are clean.
- **CI registration:** **WIRED (2026-11-28, this task)** — `.github/workflows/hygiene.yml` job `hygiene` runs the script on every PR to `main` and every push to `main`; green on PR `#24` (3s). **Residual one-time action:** add `hygiene` to the required-checks list of `main` (Settings → Branches → Required status checks, context name `hygiene`) — the automation token has Administration read but not write, so the API update is unavailable to agents; context name confirmed from the passing check run.
- **History rewriting:** none performed; none to be performed without explicit human approval (ADR-0013 keeps `zwork` history immutable).

## K. SESSION HANDOFF

- **Last Accepted Task:** `P22` (2026-11-28) — contributor identity policy + CI hygiene gate; evidence PR `#24`, ADR-0013, `.diag/74-p22-local.txt` (local gate) / `.diag/75-p22-verify.txt` (post-merge).
- **Active Tasks:** none.
- **Pending Reviews:** none.
- **Blocked:** none — §J hygiene decisions resolved (ADR-0013); Hygiene Gate green.
- **Latest Verified Result:** `bash scripts/check-contributors.sh` exit 0 over the full history; `bun run lint` 0 problems; `bun run test` 500 passed (baseline unchanged from `P21` — no spec/source changes); e2e specs untouched, so the 79-scenario `P21` baseline stands and CI runs e2e on every PR. Required checks on PR `#24`: `["scan","quality","test","e2e","hygiene"]` green. Artifact unchanged (`node_modules-ci.tgz` @ 2026-11-28T09:41:56Z — no lockfile/schema change).
- **Important Decisions:** ADR-0001…0013 (§H).
- **Open Risks:** §I — item 1 resolved 2026-11-28; items 2–10 stand.
- **Docs Updated for Last Task:** YES — `PROJECT_STATUS.md`, `docs/TESTING.md` (§4), `docs/ROADMAP_RECOVERY.md` (§9.4 addendum + §9.6 resolutions), `docs/DECISIONS.md` + `docs/adr/0013-*` (new), `AGENTS.md`, `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md` (§5, §9.4), `PROJECT_DOCUMENTATION_GUIDE.md` (ADR count), `docs/README.md` (ADR count). The 2026-11-28 documentation-bootstrap set (previously uncommitted by that task's constraint) entered the repository in the same change set: `PROJECT_STATUS.md`, `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md`, `PROJECT_DOCUMENTATION_GUIDE.md`, `docs/PRODUCT_SPEC.md`, `docs/ROADMAP_RECOVERY.md`, `docs/TESTING.md`, `AGENTS.md`, `docs/README.md`, `scripts/check-contributors.sh`.
- **Next Exact Action:** **requires human/orchestrator decision — mint `P23`**, the first product task of the post-hygiene phase. No further hygiene work is pending; candidate list §E items 2–5 (stale-docs reconciliation batch is the natural next `docs` task; then the never-executed planned-migration decisions §8.3 of the recovery report). No task prompt exists yet, so no executable command is possible until minting (protocol §6). (One-time non-blocking setup alongside: tick `hygiene` in Settings → Branches required checks — see §J.)
- **Next Task ID:** `P23` (not yet scoped; must not reuse any historical ID — protocol §4).
- **Related Files:** `docs/adr/0013-contributor-identity-and-web-flow-policy.md`, `scripts/check-contributors.sh`, `.mailmap`, `.github/workflows/hygiene.yml`, `docs/TESTING.md`, `docs/ROADMAP_RECOVERY.md`.
