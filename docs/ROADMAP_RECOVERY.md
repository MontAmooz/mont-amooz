# Roadmap & State Recovery Report (`docs/ROADMAP_RECOVERY.md`)

> Task: `META-DOC-BOOTSTRAP-RECOVERY` — documentation bootstrap & state recovery. Date: **2026-11-28**.
> Scope: documentation only. No source, test, config, migration, dependency or manifest file was modified; no Git history was rewritten; no commit/push was made.
> Purpose: reconstruct the previously planned development roadmap (whose planning conversation is lost) from repository-resident evidence, and serve as the evidence appendix for `PROJECT_STATUS.md`.

---

## 1. Verdict

- **STOP CONDITION (task §3): SATISFIED.** The repository yields (a) a stage series with referenceable IDs (`P2b` … `P21`), (b) far more than three tasks with independent evidence (merged commits, branches, `.diag` verify artifacts, ADRs, CI gates), and (c) a clear development order (per-stage preflight → implementation → verify artifacts with embedded git HEADs, plus commit dates).
- The executed stage series **`P2b` → `P21`** is recoverable with per-stage evidence. Early stages (`P1` and any pre-public-release stages) are only partially recoverable.
- **No "Wave" identifiers exist anywhere** in the repository (checked all commit messages, branch names, tags, and tracked docs — zero matches). The planning unit of record was the **prompt-stage series (`P`-numbers)** plus the product-level **Phases (فاز ۰–۴)** documented in `docs/ROADMAP.md`. No Wave naming is invented here.
- Recovery quality by class:
  - **HIGH**: `P3`, `P6`, `P7`, `P8`, `P9`, `P12`–`P21` (named in stage verify artifacts and/or commit bodies that self-reference the stage ID).
  - **MEDIUM**: `P2b`, `P4`, `P5`, `P10`, `P11` (chronology + artifact corroboration; see per-row notes), `P1` is **LOW**.

## 2. Sources Reviewed

| # | Source | What it provided |
|---|---|---|
| 1 | `git log --all` (45 commits, 2026-10-30 → 2026-11-28), `git branch -a` (15 local branches), `git tag -l` (1 tag), `git stash`/`git notes` (empty) | commit history, PR numbers, merge topology, dates |
| 2 | Commit bodies (P-references: `P1`, `P4.5`, `P4.6`, `P6`, `P7`, `P9`–`P12`, `P14`–`P17`, `P20`) | stage self-references inside messages |
| 3 | `docs/ROADMAP.md` (2026-10-30 snapshot) | the planned product Phases 0–4 + the planned hardening list `P2b`–`P9` with scopes |
| 4 | `docs/DECISIONS.md` + `docs/adr/0001…0012` | 12 accepted technical decisions, several carrying "migration at Pn" plan items |
| 5 | `.diag/` (local, gitignored) — preflight/local/verify artifacts numbered 25–73, per-stage backup bundles `backup-post-pN-*.bundle` (P7→P21) and DB snapshots `pre-pN-custom.db.bak` | per-stage acceptance gates with embedded git HEADs (the decisive evidence for the stage→PR mapping) |
| 6 | `CHANGELOG.md`, `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/GIT-STRATEGY.md`, `docs/archive/2026-10-pre-reconciliation/*` | product history, as-built architecture, git strategy, legacy planning docs (incl. `worklog-legacy.md` with legacy `Task n` IDs) |
| 7 | `package.json`, `bun.lock`, `prisma/schema.prisma`, `src/app/api` tree, `tests/` tree, `.github/workflows/*`, `.githooks/commit-msg` | tech stack from manifests, feature inventory, CI + hook state |
| 8 | Full Git identity scan (`%an/%ae/%cn/%ce`, trailers, tags, notes) | contributor hygiene audit (§9) |

Evidence rules applied (per task §4.4):
- A commit's existence alone is **not** acceptance. A stage is treated as accepted only with: merged commit on `main` + CI required checks (`scan`,`quality`,`test`,`e2e`) + a `.diag` verify artifact recording the post-stage state. Where one of these legs is missing, confidence is reduced and the gap is named.
- `.diag/` files are **local, untracked** artifacts. They carry the strongest per-stage acceptance evidence, but they are not Git-resident; a stage accepted only via `.diag` is marked as such in `PROJECT_STATUS.md §F`.
- All dates are local (+0330) as recorded in the artifacts.

## 3. Identifier Systems Found

| System | Where | Status |
|---|---|---|
| `P<n>` prompt-stage IDs (`P1`…`P21`, incl. sub-references `P4.5`, `P4.6`) | commit bodies, `.diag/NN-pN-*.txt`, ADR cross-refs | **Historical, recovered** — executed series, see §4.1 |
| Product Phases `فاز ۰–۴` | `docs/ROADMAP.md` | **Historical (plan)** — see §4.2 |
| Legacy `Task n` / `n-a` / `n-b` IDs | `docs/archive/2026-10-pre-reconciliation/worklog-legacy.md`, referenced by `CLAUDE.md` ownership conventions | Historical (pre-reconciliation era), archived |
| `ADR-0001…0012` | `docs/adr/` | Historical decisions, all ACCEPTED |
| PR numbers `#1…#23` | commit subjects | Historical, mapped to stages in §4.1 |
| "Wave" | — | **Not found anywhere** — do not invent |

> ⚠️ **Numbering collision (critical):** the `P`-numbers *planned* in `docs/ROADMAP.md` (§ "Production Hardening P3–P9") and the `P`-numbers *executed* (§4.1) are **the same identifiers with different scopes** from `P4` onward. See §7.1.

## 4. HISTORICAL (recovered — referenced evidence only)

### 4.1 Executed prompt-stage series

| Stage ID | Output (merge / commits on `main`) | Date | Evidence (git-resident) | Evidence (.diag local) | Confidence | Notes |
|---|---|---|---|---|---|---|
| `P1` | (pre-public-release era) | ≤ 2026-10-30 | commit `6526231` body: "The P1-era `download/` rule …" | none (artifacts 01–24 lost, see `.diag/26-p4-merged.txt` env note) | LOW | ID referenced once; scope unrecoverable from this repo |
| `P2b` | `#1` (`59c692c` docs: GitHub Flow ADR update, commit-msg hook, PR/issue templates) + `#2` (`ae9b45c` code-quality foundation) | 2026-10-30 | `docs/ROADMAP.md` hardening list names `P2b` with exactly this scope; ADR-0008 | none (pre-P2 bundle lost) | MEDIUM | scope in ROADMAP matches output |
| `P3` | `#3` (`aef1012` test: Vitest foundation — unit + auth integration + CI); tag `v0.3.0-deps` points here | 2026-11-01 | ROADMAP names `P3` = tests; ADR-0009; tag annotation | (P3-era artifacts lost; scope confirmed by tag + ROADMAP) | HIGH | ROADMAP-planned scope == executed scope |
| `P4` | `#5` (`2dad084` ci: diagnostic PR — ubuntu-22.04 runners, issue `#4`) + `#6` (`546414d` docs: ADR-0010 CI artifact pattern, persistent `.diag` dir) | 2026-11-01 | ADR-0010, commit subjects | `.diag/26-p4-merged.txt` (post-#3 state), `28-p5-verify.txt` git log | MEDIUM | **Diverged from ROADMAP plan** (planned P4 = PostgreSQL migration — never executed as such) |
| `P5` | no merged output recorded | 2026-11-01 | — | `.diag/28-p5-verify.txt` (CI health final gate; HEAD unchanged at `546414d`) | MEDIUM | verify-only stage; scope beyond CI-health checks unrecoverable |
| `P6` | `#7` (`12d509d` chore: rename project to مُنت‌آموز / MontAmooz) | 2026-11-01 | ADR-0011 | `.diag/30-p6-verify.txt` ("POST-RENAME STATE"; rename-integrity checks; pending org rename note) | HIGH | **Diverged from ROADMAP plan** (planned P6 = JWT — never executed) |
| `P7` | `#8` (`ba19df9` test: integration tests for all API endpoints, +130 tests) | 2026-11-02 | commit subject | `.diag/31-p7-local.txt`, `32-p7-verify.txt` ("POST-P7 STATE", 211 tests) | HIGH | planned P7 = CI/CD — CI already existed since `#1`–`#3`; executed scope = integration tests |
| `P8` | `#9` (`2502332` test(e2e): Playwright browser tests, 38 scenarios) + `#10` (`3bf0f1a` fix(ui): title rename) + `f8cea70` (feat(classroom): PORT via env — **authored by `zwork <zwork@local>`, see §9**) | 2026-11-03 → 11-12 | commits | `.diag/33-p8-local.txt`, `34-p8-verify.txt` ("POST-P8 STATE"; e2e required-check deferred decision) | HIGH | planned P8 = Sentry — never executed |
| `P9` | `#11` (`00a1615`/`8cf58c8` feat(attachments): PDF/Word uploads — ADR-0012) + `6526231` (fix(ci): root-anchor download/ rule) + `90cb2c9` (fix(test): AUTH_SECRET inheritance) | 2026-11-13 | ADR-0012; commit bodies reference "P9" patterns (`mammoth from P9`, storage `UPLOADS_DIR` note) | `.diag/35-p9-preflight.txt`, `36-p9-local.txt`, `37-p9-verify.txt` ("POST-P9 STATE") | HIGH | planned P9 = deployment — **not executed**; deployment remains a plan (`docs/DEPLOYMENT.md` is a design doc) |
| `P10` | `#12` (`3bc628d`/`ce59c8a` feat(auth): rate limiting, admin panel, password reset, session refresh) | 2026-11-14 | commit `82de243` body: "Artifact … refreshed (schema change — P10 lesson)"; seed cleanup list "P10/P11/P12 tables (… auth tokens)" | `.diag/38-p10-preflight.txt` … `41-p10-verify.txt` | MEDIUM | planned-P10 (Zarinpal) never executed; executed P10 = auth hardening |
| `P11` | `#13` (`82de243`/`93cdf9e` feat(notifications): in-app notifications, 6 events) | 2026-11-14 | seed cleanup list "P10/P11/P12 tables (… notifications …)" | `.diag/41-p11-preflight.txt` … `44-p11-verify.txt` | MEDIUM | planned-P11 (WebRTC) never executed |
| `P12` | `#14` (`8236ae8`/`30d0a21` feat(exams): Exam Builder MVP — MC exams, attempts, auto-grading) | 2026-11-17 | commit `52a4653` body ("P10/P11/P12 tables"); `f94649f` body ("breaking from P12 single POST") | `.diag/44-p12-preflight.txt` … `47-p12-verify.txt`; `47-p13-preflight.txt` shows `#14` at HEAD | HIGH | |
| `P13` | `#15` (`52a4653`/`0c41076` chore(seed+polish): expand seed content, polish landing page) | 2026-11-17 | — | `.diag/47-p13-preflight.txt` (HEAD `#14`), `48-p13-local.txt`, `49-p13-verify.txt` ("POST-P13", HEAD `#15`) | HIGH | |
| `P14` | `#16` (`f94649f`/`6870328` feat(exams): essay questions, timer, manual grading) | 2026-11-19 | commit body references P12 API break | `.diag/50-p14-preflight.txt`, `51`, `52`; `53-p15-preflight.txt` shows `#16` at HEAD | HIGH | |
| `P15` | `#17` (`22f4ab5`/`811057b` feat(lessons): Interactive Learning MVP — TEXT/MC/NUMERIC steps) + `56541d0` (e2e fix) | 2026-11-19 | `22f4ab5` body: "Failed 2/2 on the P15 preflight baseline" | `.diag/53-p15-preflight.txt`, `54`, `55-p15-verify.txt` ("POST-P15", HEAD `22f4ab5`; `/tmp` ENOSPC root-cause lesson) | HIGH | planned series in ROADMAP stops at `P9`; `P10+` were never planned in a doc — scopes recovered from artifacts only |
| `P16` | `#18` (`8066ecc`/`ddc1d08` chore(beta-readiness): rate limits raised, welcome flow, admin notify, /tmp guard) | 2026-11-20 | `1e94f91` & `997d336` bodies cite "(P16 lesson)" | `.diag/56-p16-preflight.txt` (HEAD `#17`), `57`, `58-p16-verify.txt` ("POST-P16", HEAD `8066ecc`) | HIGH | |
| `P17` | `#19` (`5da5b53`/`a979d7b` feat(experience): Word preview, teacher analytics, discovery) | 2026-11-21 | `ccfe903` body: "4 summary cards (symmetric to **P17** teacher analytics)" | `.diag/59-p17-preflight.txt` (HEAD `#18`), `60`, `61-p17-verify.txt` ("POST-P17", HEAD `5da5b53`) | HIGH | |
| `P18` | `#20` (`ccfe903`/`14463f1` feat(dashboard): student learning dashboard `#/my-learning`) | 2026-11-21 | symmetric-to-P17 reference above | `.diag/62-p18-preflight.txt` (HEAD `#19`), `63`, `64-p18-verify.txt` ("POST-P18", HEAD `ccfe903`) | HIGH | |
| `P19` | `#21` (`2011165`/`24476cd` feat(qa): pamphlet Q&A threads) + `bf86ec0` (e2e locator fix) | 2026-11-21 | — | `.diag/65-p19-preflight.txt` (HEAD `#20`), `66`, `67-p19-verify.txt` ("POST-P19", HEAD `2011165`) | HIGH | |
| `P20` | `#22` (`1e94f91`/`466c93b` feat(moderation): admin toolkit — reports, hide, suspend, dashboard) | 2026-11-22 | `997d336` body: "(P20 flake history)" | `.diag/68-p20-preflight.txt` (HEAD `#21`), `69`, `70-p20-verify.txt` ("POST-P20", HEAD `1e94f91`) | HIGH | |
| `P21` | `#23` (`997d336` feat(lessons): interactive polish — FILL_BLANK, IMAGE, BRANCHING) | 2026-11-28 | commit body: "Raise attachments.spec timeout 90s→180s (P20 flake history)" | `.diag/71-p21-preflight.txt` ("Phase R" read phase, HEAD `#22`), `72-p21-local.txt`, `73-p21-verify.txt` ("POST-P21": vitest 500, e2e 79, artifact refreshed 2026-11-28T09:41:56Z) | HIGH | latest accepted stage |

Mapping method (reproducible): each `.diag/NN-pN-preflight.txt` embeds the git HEAD at stage start and each `.diag/NN-pN-verify.txt` the HEAD at stage end; the stage's output is exactly the commits between the two HEADs. Commit-body self-references (`P12 single POST`, `P15 preflight`, `P17 teacher analytics`, `P16/P20 lesson`) independently corroborate the same mapping.

### 4.2 Product phases (plan document: `docs/ROADMAP.md`, snapshot 2026-10-30)

| Phase (فاز) | Scope (per ROADMAP.md) | Plan status in doc | Implementation status (repo evidence) | Confidence |
|---|---|---|---|---|
| فاز ۰ — community bootstrap | repo/org/docs/community calls | partially checked in doc | partially done (docs exist; community items unchecked) | HIGH (doc) |
| فاز ۱ — Pamphlet Hub | auth, pamphlets CRUD, fork/MR, reviews, search | ✅ executed | implemented & tested — v0.1.0 (`CHANGELOG.md`), `tests/integration/*`, `tests/e2e/*` | HIGH |
| فاز ۲ — Teaching marketplace | wallet, slots/sessions, video courses, live classroom (chat+board) | ✅ executed | implemented & tested — v0.2.0 (`CHANGELOG.md`), ADR-0005/0006 | HIGH |
| فاز ۳ — Exam builder + interactive learning | exams, interactive lessons, dashboards | 🚧 in progress | substantially implemented via `P12`,`P14`,`P15`,`P17`,`P18`,`P21` (see §4.1) | HIGH |
| فاز ۴ — AI & advisory | AI tutor, counseling | 🔮 future | not started (no code) | HIGH (plan exists, none implemented) |

### 4.3 Legacy task series (pre-reconciliation, archived)

`docs/archive/2026-10-pre-reconciliation/worklog-legacy.md` records legacy IDs `Task 1`, `Task 2-a`, `Task 2-b`, `Task 5`, `Task 6-a`, `Task 6-b`, `Task 7` (backend/frontend ownership conventions; also cited by `CLAUDE.md`). `DEVELOPMENT-ROADMAP.legacy.md` holds the original sprint plan (اسپرینت ۱–۱۷). **Confidence: MEDIUM** — archived read-only, superseded by the ADR process; IDs preserved here for reference only. The legacy worklog's "PROMPT 1" marker appears in `CLAUDE.md` (2026-10-30 archive note).

## 5. Acceptance evidence pattern (how stages were accepted)

Recorded pattern (constant from `P4` to `P21`): preflight gate (git clean, `/tmp` headroom, vitest + e2e baselines, services up, seed counts, no-fallback-secret check, required checks `["scan","quality","test","e2e"]`, CI artifact freshness, lockfile/schema diff) → implementation on a short branch → local gate → squash-merge PR → verify gate (post-merge test counts, artifact state, DB counts) → `backup-post-pN` bundle. This is documented as the acceptance template in `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md`.

## 6. NON-RECOVERABLE

| Item | Why |
|---|---|
| Stages before `P1` and any `P0`/`P2a` identifiers | No artifacts. `.diag/26-p4-merged.txt` records that the 2026-11-01 host reboot (tmpfs) destroyed artifacts 01–24 and the pre-P2 bundle. Possibly preserved in the private legacy repository (see below) — not inspectable from here. |
| Full scope of `P1` and `P5` | `P1` has a single commit-body mention; `P5` has a verify-only artifact with no merged output. Scopes unrecoverable. |
| Any plan for stages after `P21` (e.g., `P22+`) | No `.diag` preflight, no commit reference, no doc. If a next-stage plan existed, it lived in the lost conversation. |
| "Wave"-named plan items | Zero occurrences of "wave" in commits, branches, tags, docs. Nothing to recover. |
| The original (pre-reconciliation) planning conversation | Archived docs survive in `docs/archive/2026-10-pre-reconciliation/`, but the conversational context is gone. Private legacy repo names recorded: `OpenEduGit/open-edu-git-legacy` (`.diag/26`, Nov 1) vs `MontAmooz/mont-amooz-legacy` (`docs/GIT-STRATEGY.md` §6) — external, private, unverifiable from here. |

## 7. Contradictions Discovered

1. **P-number collision (most important).** `docs/ROADMAP.md` plans `P3`–`P9` with scopes (P3 tests, P4 PostgreSQL, P5 MinIO, P6 JWT, P7 CI/CD, P8 Sentry, P9 deployment). The executed series reused those IDs with **different scopes** (P4 CI-install reliability, P5 gate-only, P6 rename, P7 integration tests, P8 E2E, P9 attachments; then P10 auth-hardening, P11 notifications, …). Consequence: ADR plan-backreferences pointing at "migration in P4/P5/P6/P10/P11" (`adr/0002`, `0004`, `0005`, `0006`, `0007`; repeated in `docs/ARCHITECTURE.md` §9) **do not refer to executed work** — none of those migrations has happened. The executed scope of each Pn is in §4.1.
2. **CHANGELOG is stale.** Last release entry is `0.2.0` (2026-10-21); `package.json` says `0.2.1`; the only Git tag is `v0.3.0-deps` (a CI-dependency artifact tag, not a release tag). All `P7`→`P21` work is absent from `CHANGELOG.md`.
3. **Session cookie name drift.** `docs/ARCHITECTURE.md`, `docs/GIT-STRATEGY.md`, `docs/DEVELOPMENT.md`, `CLAUDE.md` say `oeg_session`; the code and preflight artifacts record `ma_session` (`src/lib/constants.ts:63`, verified in `.diag/56`, `.diag/59`).
4. **`docs/ARCHITECTURE.md` staleness.** Header date 2026-10-30 (file updated later); §10 lists "no admin panel" as a non-goal although the admin panel shipped in `P10`; model count "28" vs 30 `model` declarations in `prisma/schema.prisma` (`PamphletComment` P19, `Report` P20 added later).
5. **`docs/README.md`** says the ADR directory holds "۸ سند" (8) — it holds 12.
6. **`CLAUDE.md`** references "8 ADRs", a non-existent `./start.sh` (it self-flags this), and stale sandbox notes; last-updated 2026-10-23/11-01 era.
7. **Legacy repo name recorded two ways** (see §6, last row) — org was renamed Nov 1 (`.diag/30-p6-verify.txt` pending-action note), explaining the difference; current name not verifiable from this clone.
8. **Contributor identity (see §9).** The task's allowed-identity string `montajebii <mohammad.montajebii@gmail.com>` matches the repo's **email** exactly, but the repo's **name** is `Mohammadreza Montajebi` — a strict name+email comparison fails on the maintainer's own 44 commit slots. A canonical decision is required (§9.6-1).

## 8. PROPOSED (not historical — requires explicit human approval; no IDs minted)

These are candidate next items derived from current state. They carry **no historical identifiers** and enter the historical record only after human confirmation.

1. Reconcile the P-numbering: decide whether future stages continue `P22, P23, …` and record the executed-vs-planned divergence permanently (e.g., an ADR).
2. Reconcile stale docs: `CHANGELOG.md` (0.2.1+ and P7–P21 entries), `docs/ARCHITECTURE.md` (cookie name, admin panel, 30 models, date), `docs/GIT-STRATEGY.md`/`docs/DEVELOPMENT.md` (cookie name), `docs/README.md` (ADR count), `CLAUDE.md` (disposition itself is a hygiene decision — §9.6-4).
3. Execute or formally retire the never-executed planned migrations: PostgreSQL (ADR-0002), MinIO/large-file storage (ADR-0007, superseded in part by ADR-0012 local-disk attachments), JWT (ADR-0004), Zarinpal (ADR-0005), WebRTC (ADR-0006), external FTS, Sentry (ROADMAP P8-planned), production deployment (`docs/DEPLOYMENT.md` is a design doc only).
4. Compliance workstream from ROADMAP (e-namad, ToS, privacy policy) before public paid launch.
5. Hygiene decisions + wiring per §9.6 (identity canonicalization, web-flow policy, CI registration) — **requires human approval first**.

## 9. Contributor Hygiene Audit Report

Method (task §4.5): full scan of author/committer identities (`%an/%ae/%cn/%ce` over `--all`), commit-body trailers (`Co-authored-by`, `Signed-off-by`, …), tag annotations (1 tag), notes (none), `.mailmap` (absent), `CONTRIBUTORS.md`/`CODEOWNERS` (CODEOWNERS absent), plus text search of tracked files and commit messages for tool/agent names. **No history was rewritten. Everything below is reported, not repaired.**

### 9.1 Unique identities in history (45 commits)

| Type | Name | Email | Count | First seen | Last seen | Commit SHA(s) | Verdict vs allowed `montajebii <mohammad.montajebii@gmail.com>` |
|---|---|---|---|---|---|---|---|
| Author | Mohammadreza Montajebi | mohammad.montajebii@gmail.com | 22 | 2026-10-30 (`b20c924`) | 2026-11-22 (`466c93b`) | local branch commits + initial release (e.g. `b20c924`, `811057b`, `24476cd`, `bf86ec0`, `466c93b`) | **Email matches exactly; NAME does not** (task string says `montajebii`) → decision needed (§9.6-1) |
| Committer | Mohammadreza Montajebi | mohammad.montajebii@gmail.com | 22 | 2026-10-30 | 2026-11-22 | same set as above | same as above |
| Author | M0nt | 67793307+montajebii@users.noreply.github.com | 22 | 2026-10-30 (`59c692c`) | 2026-11-28 (`997d336`) | `997d336 1e94f91 2011165 ccfe903 5da5b53 8066ecc 22f4ab5 f94649f 52a4653 8236ae8 82de243 3bc628d 00a1615 3bf0f1a 2502332 ba19df9 12d509d 546414d 2dad084 aef1012 ae9b45c 59c692c` | GitHub web identity of the same maintainer (handle `montajebii` per `CONTRIBUTORS.md`); both name and email differ from the allowed string → policy decision (§9.6-2) |
| Committer | GitHub | noreply@github.com | 22 | 2026-10-30 | 2026-11-28 | same 22 merge commits (GitHub web-flow "squash/merge" committer) | Standard GitHub artifact of PR merges → policy decision (§9.6-2) |
| Author + Committer | zwork | zwork@local | 1 (+1 trailer) | 2026-11-03 (`f8cea70`) | 2026-11-03 | `f8cea70` (feat(classroom): make PORT configurable via env; landed on `main` via PR `#9`) | **Unauthorized identity** — neither name nor email matches; also cited in a `Co-authored-by` trailer inside merged `#9` body (`2502332`) |

Trailer scan: exactly one `Co-authored-by: zwork <zwork@local>` (inside `2502332`). No `Signed-off-by` or other trailers. Tag annotation (`v0.3.0-deps`) contains no identities. `git notes`: none.

### 9.2 Agent/harness/tool name occurrences in tracked files and messages

| Location | Occurrence | Nature | Disposition |
|---|---|---|---|
| Commit messages (subjects+bodies, all 45) | **none found** (grep for claude/gpt/copilot/cursor/windsurf/devin/aider/harness/assistant etc.) | — | clean — the `.githooks/commit-msg` + CI `commit-lint.yml` blocklist has been effective |
| `CLAUDE.md` (tracked) | "This file provides guidance to Claude Code (claude.ai/code)…" + filename | Harness instruction file, tracked in the public repo | Pre-existing; conflicts with the contributor-identity rule → decision §9.6-4 |
| `docs/archive/2026-10-pre-reconciliation/CLAUDE.md` | same, archived copy | archived read-only | same decision |
| `.githooks/commit-msg` | blocklist *patterns* naming AI tools (claude, chatgpt, gpt-[0-9], openai, anthropic, copilot, …) | This **is** the text-hygiene control; naming the blocked tools is its function | keep (self-referential control) |
| `.github/workflows/commit-lint.yml` | same blocklist in CI | same | keep |
| `docs/GIT-STRATEGY.md` §3 | policy section citing the blocklist examples | policy documentation of the control | keep (documents the rule, does not credit a tool) |
| `package.json` | dependency `"z-ai-web-dev-sdk": "^0.0.18"` | runtime dependency whose name embeds a vendor/AI marker; **grep finds no import in `src/` or `mini-services/`** (unused as of 2026-11-28) | observation — removal is a code/dependency change outside this documentation task; flagged for a future code-hygiene pass |

Local `.diag/` artifacts contain no tool names (checked the read set; the workflow files use neutral "prompt/phase" wording).

### 9.3 Files bearing on contributor hygiene

| File | State |
|---|---|
| `.mailmap` | **created 2026-11-28** (task `P22`, ADR-0013) — maps `zwork <zwork@local>` to the canonical identity for display only; commit objects, SHAs and dates untouched |
| `CODEOWNERS` (root/`docs/`/`.github/`) | **absent** |
| `CONTRIBUTORS.md` | present — lists only the maintainer (`@montajebii`, محمدرضا منتجبی); no unauthorized names |
| `.githooks/commit-msg` | present, executable; blocks AI-tool names in messages + AI `Co-Authored-By` trailers (see §9.2) — active via `core.hooksPath` (confirmed in repo config) |
| CI workflows | `commit-lint.yml` enforces message hygiene on PRs; `secret-scan.yml` scans secrets; **no contributor-identity check exists yet** |

### 9.4 Current contributor-identity test status

`scripts/check-contributors.sh` (created by this task, spec per task §8) compares every author/committer identity against the allowed string `montajebii <mohammad.montajebii@gmail.com>`. **Current result: FAIL** — by design it flags: (a) the maintainer's real name `Mohammadreza Montajebi` (email matches), (b) `M0nt` + `GitHub` web-flow identities on all 22 PR-merge commits, (c) `zwork <zwork@local>`. This is an accurate reflection of history vs the task's strict rule, **not** a script bug. The command and its output are documented in `docs/TESTING.md` § Hygiene Tests.

> **Addendum 2026-11-28 (task `P22`, ADR-0013):** the historical FAIL above is now resolved — the allowlist was updated to the decided policy (canonical `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>` + web-flow pair + accepted `zwork`, exact whole-line matching). The script now **passes over the full history (exit 0)**; current output in `docs/TESTING.md §4.1`. The audit tables in §9.1/§9.2 above remain the historical record of what was flagged.

### 9.5 Text hygiene test status

Two layers already exist and pass: `.githooks/commit-msg` (local) and `.github/workflows/commit-lint.yml` (CI). This task adds a documented docs-scan command in `docs/TESTING.md`. Known self-matches (policy files naming the blocked tools, listed in §9.2) are documented exceptions, not violations.

### 9.6 Cleanup decisions — **items 1–3 & 5 RESOLVED 2026-11-28 (task `P22`, ADR-0013); items 4 & 6 still open**

> Resolution status appended per item below; the original proposal text is preserved as the decision record.

1. **Canonical identity decision.** Either (a) update the allowed string to the real Git identity `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>` (recommended — matches `git config` and 44/45 commit slots), or (b) keep the task string and rename the Git identity going forward. Then update `scripts/check-contributors.sh` `ALLOWED` accordingly.
   - ✅ **RESOLVED 2026-11-28 (task `P22`):** option (a) approved — canonical identity is `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>`; script allowlist updated (ADR-0013, decision 1).
2. **Web-flow policy.** Decide whether PR-merge committer identities (`M0nt <…users.noreply.github.com>`, `GitHub <noreply@github.com>`) are allowlisted (standard GitHub squash-merge artifacts) or future merges are done locally (author+committer = canonical identity only). Option (a) keeps `main` history as-is; option (b) changes merge practice going forward.
   - ✅ **RESOLVED 2026-11-28 (task `P22`):** option (a) approved — both identities allowlisted as valid squash-merge artifacts; merge practice unchanged (ADR-0013, decision 2).
3. **`zwork <zwork@local>` disposition.** Options: (a) accept and document (history stays immutable — recommended; the commit is functionally attributed to the maintainer via PR `#9` squash-merge authorship `M0nt`), or (b) rewrite authorship with `git filter-repo` + force-push (breaks clones, tags, CI artifact references — **not recommended**, and explicitly not performed here). A `.mailmap` entry can neutralize the display either way. **Human approval required for any option touching history.**
   - ✅ **RESOLVED 2026-11-28 (task `P22`):** option (a) approved — accepted and documented; `.mailmap` created (display unification to the canonical identity). **No history rewriting performed or permitted** — dates/SHAs verified untouched (ADR-0013, decision 3).
4. **`CLAUDE.md` disposition.** Decide whether to archive it under `docs/archive/` and keep `AGENTS.md` as the single agent-instructions file (future documentation task; this task did not modify it per the preserve-existing constraint).
5. **Wire hygiene into CI.** Add a job running `scripts/check-contributors.sh` (+ optionally the docs text scan) to `.github/workflows/` — this modifies CI config and is therefore out of scope here (task constraint §2.1); recorded as a proposed change.
   - ✅ **RESOLVED 2026-11-28 (task `P22`):** wired as job `hygiene` in `.github/workflows/hygiene.yml` (checkout `fetch-depth: 0`, runs the script on every PR to `main` and push to `main`; registered in `docs/TESTING.md §4.3`). The optional docs text scan remains unwired (documented self-matches would need an exclusion list).
6. **Prevent recurrence** of off-machine identities (e.g., set `git config --global user.name/email` explicitly, or repo-level config) — future operational task.

## 10. Questions for the Next Orchestrator

1. Approve the canonical contributor identity (§9.6-1) and web-flow policy (§9.6-2) — blocks all commit acceptance until resolved.
2. Confirm the executed-stage table (§4.1) as the historical record of `PROJECT_STATUS.md §C`, and mint the next stage ID (proposal: continue `P22+`).
3. Choose which never-executed planned migrations (§8.3) become the next tasks, in what order — or formally retire them via ADR.
4. Decide the stale-docs reconciliation batch (§8.2): one documentation task or per-doc tasks.
5. Decide `CLAUDE.md`/`AGENTS.md` consolidation (§9.6-4) and whether `package.json`'s `z-ai-web-dev-sdk` dependency is intentional.
6. Confirm that "no Wave identifiers exist" is the expected state (i.e., the lost roadmap used P-stages/Phases only).
