<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project decisions — read before proposing changes

Read `docs/DECISIONS.md` and `docs/adr/` **before proposing any technical change.**

- The implemented stack (Next.js 16 + Prisma + SQLite + HMAC sessions + socket.io mini-service) intentionally diverges from the archived planning docs in `docs/archive/` — that divergence is documented, not accidental.
- When in doubt about stack choices, see the ADRs — **do not silently diverge.** To change a decision, write a new ADR (`docs/adr/NNNN-…`) and mark the old one SUPERSEDED.
- Documentation map for agents: `docs/README.md` (index), `docs/ARCHITECTURE.md` (as-built), `docs/DEVELOPMENT.md` (setup + the SQLite path gotcha), `docs/GIT-STRATEGY.md` (branches/commits).

## Orchestration state & workflow (added 2026-11-28)

- **Current execution state lives in `PROJECT_STATUS.md`** (Task Registry §F, Session Handoff §K). Recovery evidence: `docs/ROADMAP_RECOVERY.md`. Process rules: `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md`. Doc ownership: `PROJECT_DOCUMENTATION_GUIDE.md`.
- **Documentation Step (mandatory): no commit/push without updating the task's documentation in the same change set** — at minimum `PROJECT_STATUS.md` (§F row + §K handoff); plus `docs/TESTING.md` (test changes), `docs/ARCHITECTURE.md` (architecture changes), a new ADR (technical decisions). Acceptance with stale documentation is invalid.
- **Test commands:** `bun run lint`, `bun run test`, `bunx playwright test` — full matrix + hygiene tests in `docs/TESTING.md`. Check `df -h /tmp` around long test runs.
- **Hygiene Gate:** run `bash scripts/check-contributors.sh` before any commit; it must pass or a recorded human decision must exist (`docs/ROADMAP_RECOVERY.md §9.6`).

## Contributor Identity Rule (added 2026-11-28)

- **The only permitted contributor identity for new commits is the canonical maintainer identity: `Mohammadreza Montajebi <mohammad.montajebii@gmail.com>`** (decided 2026-11-28: `docs/adr/0013-contributor-identity-and-web-flow-policy.md`; the allowlist in `scripts/check-contributors.sh` additionally covers the GitHub web-flow pair and the accepted historical `zwork <zwork@local>`, unified via `.mailmap`).
- No agent, harness, automation-tool, or other foreign identity may appear as author, committer, or `Co-Authored-by` trailer, or be credited in any document. Commits speak with a human voice (rationale and enforcement: `docs/GIT-STRATEGY.md §3`, `.githooks/commit-msg`, `.github/workflows/commit-lint.yml`).
- No Git history rewriting (no `filter-repo`/`reset --hard` on shared branches/force-push) without explicit human approval.
- No secrets, tokens, or `.env` content in code, docs, or commit messages.
