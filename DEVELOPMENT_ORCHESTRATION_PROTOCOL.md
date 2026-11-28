# DEVELOPMENT ORCHESTRATION PROTOCOL

> Fixed process contract for developing مُنت‌آموز. Created 2026-11-28 (task `META-DOC-BOOTSTRAP-RECOVERY`).
> State lives in `PROJECT_STATUS.md` (+ evidence in `docs/ROADMAP_RECOVERY.md`); this file defines **how** work is orchestrated; `PROJECT_DOCUMENTATION_GUIDE.md` defines **which document owns which information**.
> This protocol is self-contained: an agent holding only this file + `PROJECT_STATUS.md` + the referenced docs can continue development without any conversation history.

## 1. Orchestrator Role & Responsibilities

The Orchestrator (a human, or an agent session acting in that role) is responsible for:

1. **Analysis** — reading `PROJECT_STATUS.md` §B/§K and the current code before minting any task.
2. **Roadmap** — maintaining §C (historical) and §E (proposed) of `PROJECT_STATUS.md`; converting approved proposals into tasks with IDs.
3. **Task definition** — one prompt per task, self-contained (§6), with explicit acceptance criteria and evidence requirements.
4. **Prompt engineering** — prompts must carry: task ID, objective, constraints, exact files in scope, test commands, docs-to-update list, and the hygiene gate reminder.
5. **Review** — verifying acceptance evidence (§8) before any status change to `ACCEPTED`.
6. **Release** — CHANGELOG + version + tag per `docs/GIT-STRATEGY.md` §5.

## 2. Task Lifecycle

```
BACKLOG → READY → IN_PROGRESS → IN_REVIEW → NEEDS_VERIFICATION → ACCEPTED
   ↘ CANCELLED        ↘ BLOCKED (any state)        ↘ SUPERSEDED (any state)
```

| State | Meaning | Exit condition |
|---|---|---|
| `BACKLOG` | recorded idea/proposal (from `PROJECT_STATUS.md §E`) | human approves → `READY` |
| `READY` | task prompt written, ID minted, dependencies clear | work starts |
| `IN_PROGRESS` | implementation on a short branch | tests pass locally |
| `IN_REVIEW` | PR open; CI required checks running/pending | checks green |
| `NEEDS_VERIFICATION` | merged; acceptance evidence being collected (per-stage gate pattern, `docs/ROADMAP_RECOVERY.md §5`) | evidence complete |
| `ACCEPTED` | evidence verified **and** Documentation Step done — the only state that counts as done | terminal |
| `BLOCKED` | cannot proceed (missing decision, failing gate, external blocker) | record blocker in `PROJECT_STATUS.md §B` |
| `SUPERSEDED` | replaced by another task/ADR | link the replacement |
| `CANCELLED` | dropped | record reason |

Transitions must be reflected in `PROJECT_STATUS.md §F` (Task Registry) and, at session end, §K (Session Handoff).

## 3. Documentation Step (mandatory, before commit/push)

**No commit or push may be made until the task's documentation is updated in the same change set.** This happens after tests pass and before `git commit`/`push`:

| Condition | Required update |
|---|---|
| always | `PROJECT_STATUS.md` — Task Registry row (status/evidence/updated-at) + `SESSION HANDOFF` (§K) |
| tests added/changed/removed | `docs/TESTING.md` (commands/counts) |
| architecture/data-flow/routes changed | `docs/ARCHITECTURE.md` |
| new technical decision or a decision changed | new ADR `docs/adr/NNNN-*.md` + row in `docs/DECISIONS.md` (mark the old one SUPERSEDED if replaced) |
| schema changed | CI artifact rebuild per ADR-0010 + `docs/DEVELOPMENT.md` note if DB workflow changed |
| user-facing behavior changed | relevant user guide (`docs/USER-GUIDE-*.md`) |

Acceptance of a task with stale documentation is **invalid** (§8). The Documentation Step is part of the Definition of Done, not an afterthought.

## 4. Identifier Rules

1. **IDs are immutable.** A task/stage ID (e.g., `P21`) never changes, is never renumbered, and is never reused for different scope. Historical IDs recovered in `docs/ROADMAP_RECOVERY.md §4.1` are fixed forever.
2. **No replacement.** A cancelled/superseded ID leaves a gap; the next work takes the next free ID. (Current convention proposal: continue `P22, P23, …` — to be confirmed by human decision, `PROJECT_STATUS.md §E.5`.)
3. **Unique per record.** One ID = one task = one Task Registry row. Sub-steps may use `Pnn.a`-style suffixes; they never collide with an existing ID.
4. Historical record correction happens only in `docs/ROADMAP_RECOVERY.md` with a dated note — never by rewriting §C rows to fit new narratives.

## 5. Contributor Identity Rule

- **The only permitted contributor identity for new commits is the canonical maintainer identity:** `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>` (decided 2026-11-28, ADR-0013 — resolves the former pending string `docs/ROADMAP_RECOVERY.md §9.6-1`). The script's allowlist additionally covers the GitHub web-flow pair (`M0nt`, `GitHub`) and the accepted historical `zwork <zwork@local>` (display unified via `.mailmap`; no history rewriting).
- **No agent, harness, automation-tool, or other foreign identity may be recorded** as author, committer, or `Co-Authored-by` trailer, nor credited in documents. Commits speak with a human voice (policy rationale: `docs/GIT-STRATEGY.md §3`).
- Tooling that *enforces* this (blocklists naming the banned tools) is exempt — naming the banned thing is the control's function.
- Every commit must be made with the approved identity configured locally (`git config user.name / user.email`).

## 6. Standard Agent Prompt Template

Each task prompt must be self-contained (no reliance on chat history). Minimum skeleton:

```markdown
# TASK: <one-line objective>
**Task ID:** <ID>          **Type:** <feature|fix|docs|chore|test>          **Status:** READY

## Context (state, not history)
- Read first: PROJECT_STATUS.md (§B, §F, §K), docs/DECISIONS.md + relevant docs/adr/*
- Current baseline: <commit/PR of last ACCEPTED task + latest verified test counts>
- Related docs: <list>

## Objective
<what and why — no restatement of history>

## Hard Constraints
- Stack/divergence per docs/DECISIONS.md — no silent divergence (new ADR to change a decision)
- Scope: <files allowed to change>; do not touch: <list>
- No secrets in code/docs; no agent/harness names in commits or docs (Contributor Identity Rule)
- No history rewriting; no force-push

## Verification
- Commands: bun run lint && bun run test ; e2e: bunx playwright test <relevant specs>
- Check df -h /tmp before/after long runs (docs/DEVELOPMENT.md)
- CI required checks: scan, quality, test, e2e

## Documentation Step (before commit/push)
<which docs to update per Protocol §3>

## Acceptance Criteria
<concrete, checkable conditions incl. evidence to record in PROJECT_STATUS.md §F>

## Hygiene Gate
Run scripts/check-contributors.sh before commit; must pass (or a recorded human decision is on file).
```

## 7. Parallel Execution Rules

Parallel execution is allowed **only** for genuinely independent tasks. Before approving a parallel group, verify all of:

1. **File overlap** — no shared file in the two scopes (including tests, seeds, config); shared libs (`src/lib/*`, `src/components/edu/store.ts`) are conflict-prone by default.
2. **API contracts** — if tasks exchange data, the contract must be written down (types in `src/lib/types.ts` or an ADR excerpt) before either starts.
3. **Schema** — any task touching `prisma/schema.prisma` invalidates parallelism (CI artifact + migration ordering per ADR-0010).
4. **Merge order** — declared up-front; rebase discipline per `docs/GIT-STRATEGY.md` (GitHub Flow, squash).
5. **Branches / worktrees** — each task on its own branch; worktrees (if used) must not share the SQLite file or `:3000`/`:3003` ports.
6. **Registry** — the group is registered in `PROJECT_STATUS.md §G` before work starts and updated at merge.

If any check fails → serialize the tasks.

## 8. Acceptance Rules

A task becomes `ACCEPTED` only when **all** hold:

1. Code merged to protected `main` via PR (squash; required checks `scan`,`quality`,`test`,`e2e` green).
2. Verification evidence recorded (per-stage gate pattern — preflight/baselines/post-merge verify; `.diag/verify` artifact or equivalent committed record).
3. A commit's existence alone is not acceptance; nor is a prior success report.
4. **Documentation Step completed** — no acceptance with stale docs (§3).
5. **Hygiene Gate passed** (§9).
6. Task Registry row + Session Handoff updated in `PROJECT_STATUS.md`.

## 9. Hygiene Gate (mandatory before every commit/push)

1. **Contributor identity test** — run `scripts/check-contributors.sh`; it must pass (or a recorded human decision on file explains a documented exception). Spec: `docs/TESTING.md` § Hygiene Tests.
2. **Text hygiene** — `.githooks/commit-msg` (active via `core.hooksPath=.githooks`) blocks AI-tool names in messages and AI `Co-Authored-by` trailers; CI double-enforces via `commit-lint.yml`. Never bypass with `--no-verify` (CI will reject the PR).
3. **Secrets** — no token/key/`.env` content in code, docs, or commit messages; `secret-scan.yml` guards CI.
4. **CI wiring status:** **wired 2026-11-28** (task `P22`) — `.github/workflows/hygiene.yml` job `hygiene` runs `scripts/check-contributors.sh` on every PR to `main` and every push to `main`; the local run remains mandatory per this protocol.

## 10. Roadmap Change Management

Any change to the roadmap (new stage, scope change, retirement of a planned migration) requires:

1. **Reason** (why now; what changed).
2. **Affected tasks** — listed by ID, each moved to `SUPERSEDED`/`CANCELLED`/re-scoped explicitly.
3. **Replacement tasks** — minted with new IDs (never reuse).
4. **Registration** — `PROJECT_STATUS.md §E` (proposal) → human approval → §C/§F entries; ADR written if a technical decision is involved.

## 11. Context Window Management

- **State lives in documents, not in conversation.** Every fact an agent needs mid-task must come from: `PROJECT_STATUS.md`, `docs/ROADMAP_RECOVERY.md`, `docs/DECISIONS.md` + ADRs, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`.
- Session-local scratch (diagnostics, logs) goes to `.diag/` (gitignored) and is never referenced as the *only* record of an accepted decision — commit the durable parts into the docs above.
- Long sessions: before ending, update §K (Session Handoff) so a fresh session can resume without history.

## 12. Session Handoff (rules)

A session hands off by leaving `PROJECT_STATUS.md §K` complete:

- Last Accepted Task (with evidence pointer) · Active Tasks · Pending Reviews · Blocked (with the exact blocking decision) · Latest Verified Result · Important Decisions · Open Risks · Docs Updated (YES/NO + list) · **Next Exact Action** (a concrete executable command, or the explicit sentence "requires human decision" naming the decision) · Next Task ID (or "none minted") · Related Files.

A new session starts by reading §K first, then §B/§F, then the referenced evidence. If §K's Next Exact Action says "requires human decision", the session must not invent work — it surfaces the decision.

## 13. Git Conventions

Outsourced to [`docs/GIT-STRATEGY.md`](docs/GIT-STRATEGY.md) (GitHub Flow, Conventional Commits, squash merges, protected `main`, human-voice message rule) — do not duplicate here.
