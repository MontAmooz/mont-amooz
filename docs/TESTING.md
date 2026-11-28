# docs/TESTING.md — Test Commands & Hygiene Tests

> Only commands that actually exist in this repository (verified against `package.json`, `vitest.config.ts`, `playwright.config.ts`, 2026-11-28). Setup and DB workflow: [`docs/DEVELOPMENT.md`](DEVELOPMENT.md). Architecture context: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

## 1. Test Suite Composition

| Suite | Location | Count (files) | Config |
|---|---|---|---|
| Unit | `tests/unit/` | 10 files | `vitest.config.ts` |
| Integration (API, ephemeral dev server + throwaway SQLite) | `tests/integration/` | 27 files | `vitest.config.ts`, helpers in `tests/helpers/server.ts` |
| E2E (Playwright, Chromium) | `tests/e2e/` | 25 specs | `playwright.config.ts`, infra in `tests/e2e/infra.ts`, `tests/e2e/server-main.ts` |

Latest recorded full-run results at stage `P21` acceptance (2026-11-28, `.diag/73-p21-verify.txt`): **vitest 500 tests passed**, **e2e 79 scenarios** (CI required checks `scan`,`quality`,`test`,`e2e` green).

## 2. Commands (package.json scripts)

```bash
bun install                      # deps (CI restores node_modules from release artifact v0.3.0-deps — ADR-0010)

bun run lint                     # eslint (0 problems expected)
bun run test                     # vitest run — unit + integration
bun run test:watch               # vitest watch mode
bun run test:coverage            # vitest + coverage (informational — ADR-0009)

bunx playwright test             # e2e (Playwright; not a package.json script — run via bunx)
bunx playwright test tests/e2e/exams.spec.ts   # single spec (solo rerun for flake triage)
```

Dev/build/DB scripts (`bun run dev`, `bun run build`, `bun run db:push`, `bun prisma/seed.ts`, …): see [`docs/DEVELOPMENT.md`](DEVELOPMENT.md).

## 3. Known Environmental Lessons (read before long test sessions)

1. **`/tmp` exhaustion masquerades as route 404s** — check `df -h /tmp` before/after suites; never leave `node_modules-ci.tgz` in `/tmp` (full story + fix commands: [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) § `/tmp` Disk Exhaustion).
2. **Full-run compile-race 404s** — dynamic routes (e.g., exam `submit`) can return Next's HTML 404 in full E2E runs while solo runs pass (documented in `tests/e2e/infra.ts:318`; e.g. `.diag/71-p21-preflight.txt`). Triage: solo rerun of the failing spec before suspecting code.
3. **CI artifact freshness** — after `bun.lock` or `prisma/schema.prisma` changes, the `v0.3.0-deps` artifact must be rebuilt and re-uploaded, or CI sees stale deps (ADR-0010; rebuild/upload commands in `docs/DEVELOPMENT.md`).
4. Vitest must **inherit `AUTH_SECRET`** from the ambient `.env` (workers do not read the file themselves).

## 4. Hygiene Tests

### 4.1 Contributor Hygiene Test

Script: [`scripts/check-contributors.sh`](../scripts/check-contributors.sh) — scans every author/committer identity in the full Git history (`git log --all`) and fails on any identity not in the allowlist. Matching is exact whole-line fixed-string, so both the name and the email must match verbatim.

```bash
bash scripts/check-contributors.sh
```

- Allowlist (decisions recorded 2026-11-28, policy: [`docs/adr/0013-contributor-identity-and-web-flow-policy.md`](adr/0013-contributor-identity-and-web-flow-policy.md)):
  1. `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>` — canonical maintainer identity (matches `git config`; all future local commits use it).
  2. `M0nt <67793307+montajebii@users.noreply.github.com>` — GitHub web identity of the same maintainer (squash-merge author).
  3. `GitHub <noreply@github.com>` — GitHub web-flow committer on squash-merges.
  4. `zwork <zwork@local>` — accepted as historical (commit `f8cea70`, 2026-11-03, via PR `#9`); `.mailmap` unifies its display to the canonical identity. No history rewriting.
- **Current output (since 2026-11-28, task `P22`):**

```
Contributor hygiene: OK (every author/committer identity is allowlisted per ADR-0013).
```

(Historical pre-`P22` failure output — the four classes flagged before the decisions above: `docs/ROADMAP_RECOVERY.md §9.4`. The audit tables remain in `docs/ROADMAP_RECOVERY.md §9`.)

### 4.2 Text Hygiene Test (no AI-tool names in commit messages / docs)

Two layers exist and are enforced:

- **Local hook:** `.githooks/commit-msg` (active via `git config core.hooksPath = .githooks`) — rejects commit messages containing AI agent/model names and `Co-Authored-By` trailers referencing agents/bots. Never bypass with `--no-verify` — CI rejects the PR.
- **CI:** `.github/workflows/commit-lint.yml` enforces the same rule on every PR.

Manual scan of the tracked working tree (useful before pushing doc changes):

```bash
git ls-files -z | xargs -0 grep -inE 'claude|chatgpt|gpt-[0-9]|openai|anthropic|copilot|cursor[- ]ai|gemini|codex|aider|windsurf|devin|z-ai'
```

Known documented self-matches (not violations): the blocklists themselves (`.githooks/commit-msg`, `.github/workflows/commit-lint.yml`, `docs/GIT-STRATEGY.md §3` — naming the banned tools is the control's function), the archived agent-instruction files under `docs/archive/` (root copy retired 2026-11-28 to `docs/archive/2026-11-post-recovery/`; `AGENTS.md` is the single agent-instructions file — `docs/ROADMAP_RECOVERY.md §9.6-4` resolved), and the unused dependency `z-ai-web-dev-sdk` in `package.json` (removal is a code change, pending decision). Full findings table: `docs/ROADMAP_RECOVERY.md §9.2`.

### 4.3 Registration Status

| Layer | Contributor identity check | Text hygiene |
|---|---|---|
| Local pre-commit | manual run of `scripts/check-contributors.sh` (mandatory per `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md §9`) | ✅ `.githooks/commit-msg` active |
| CI | ✅ **wired** (2026-11-28, task `P22`): `.github/workflows/hygiene.yml` — job `hygiene` runs the script with `fetch-depth: 0` on every PR to `main` and every push to `main` | ✅ `commit-lint.yml` |

Both CI layers must stay green alongside `scan`,`quality`,`test`,`e2e`. `hygiene` is intended as a required check for `main`; adding it to the branch-protection list is a one-time UI action (Settings → Branches → Required status checks, context `hygiene`) — automation tokens hold Administration read but not write, so agents cannot toggle it via API (recorded in `PROJECT_STATUS.md §J`).

## 5. Recorded Gate Pattern (stage acceptance)

Preflight (clean tree, `/tmp` headroom, vitest + e2e baselines, services `:3000`/`:3003`, seed counts, no-fallback-secret, required checks, artifact freshness, lockfile/schema diff) → implementation → local gate → squash-merge PR → post-merge verify (test counts, artifact state, DB counts) → `backup-post-pN` bundle in `.diag/`. Example artifacts: `.diag/71-p21-preflight.txt`, `.diag/73-p21-verify.txt`.
