# PROJECT DOCUMENTATION GUIDE

> Which document owns which information, when each must be updated, and how conflicts resolve.
> Created 2026-11-28 (task `META-DOC-BOOTSTRAP-RECOVERY`). Supersedes no existing doc — it indexes them.

## 1. Source of Truth

| Information | Authoritative Document | Note |
|---|---|---|
| Current state & Roadmap | `PROJECT_STATUS.md` | execution-level truth: stage status, task registry, handoff |
| Workflow / process | `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md` | lifecycle, gates, prompt template |
| Documentation rules | `PROJECT_DOCUMENTATION_GUIDE.md` (this file) | ownership + update triggers |
| Product requirements | `docs/PRODUCT_SPEC.md` | implemented vs planned capabilities, kept separate |
| Product-level roadmap (phases) | `docs/ROADMAP.md` | historical product plan (2026-10-30 snapshot); execution state always read from `PROJECT_STATUS.md` |
| Architecture | `docs/ARCHITECTURE.md` | as-built; see its staleness notes in `docs/ROADMAP_RECOVERY.md §7.4` until reconciled |
| Historical decisions | `docs/DECISIONS.md` + `docs/adr/` | the task template's `docs/DECISIONS/` corresponds to these two (the repo's actual structure — 13 ADR files + index); no `docs/DECISIONS/` directory exists or is created |
| Agent instructions | `AGENTS.md` | entry point for coding agents; includes the Contributor Identity Rule |
| Testing | `docs/TESTING.md` | only commands that actually exist |
| Deployment | `docs/DEPLOYMENT.md` | design doc — nothing deployed yet |
| Contributor hygiene | `docs/TESTING.md` (tests) + `AGENTS.md` (rule) + `PROJECT_STATUS.md §J` (status) + full audit in `docs/ROADMAP_RECOVERY.md §9` | four-part ownership, cross-linked |
| Roadmap recovery evidence | `docs/ROADMAP_RECOVERY.md` | evidence appendix for §C/§D of `PROJECT_STATUS.md` |
| Development setup | `docs/DEVELOPMENT.md` | environment, DB gotchas, `/tmp` hazard |
| Git strategy | `docs/GIT-STRATEGY.md` | GitHub Flow, commits, releases |
| Branding / contributing / conduct | `docs/BRAND.md`, `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`, `docs/USER-GUIDE-*.md` | product-side docs |
| Version history | `CHANGELOG.md` | currently stale past v0.2.0 — see recovery §7.2 |
| Archived planning (read-only) | `docs/archive/2026-10-pre-reconciliation/` | superseded; never cited as current truth |

## 2. Update Triggers (mandatory)

1. **Task acceptance** — always: `PROJECT_STATUS.md` (Task Registry row + Session Handoff).
2. **Before commit/push of any task** — Documentation Step per `DEVELOPMENT_ORCHESTRATION_PROTOCOL.md §3` (no commit with stale docs).
3. **Roadmap change** — proposal → human approval → `PROJECT_STATUS.md §C/§D/§E/§F`; ADR if a technical decision changed.
4. **Technical decision** — new ADR + `docs/DECISIONS.md` row (mark predecessor SUPERSEDED when replaced).
5. **API/Schema change** — `docs/ARCHITECTURE.md` (+ CI artifact note per ADR-0010; seed note if data shape changed).
6. **Test suite change** — `docs/TESTING.md` (commands, counts).
7. **Release status change** — `CHANGELOG.md` + version + tag per `docs/GIT-STRATEGY.md §5`.
8. **Hygiene-relevant change** — `PROJECT_STATUS.md §J` (+ recovery §9 addendum if a new identity/finding appears).

## 3. Anti-Duplication Rules

- Each fact has exactly one authoritative home (§1). Other documents **link**, not copy.
- Pointers, not content: process details live in the protocol; setup commands in `docs/DEVELOPMENT.md`; test commands in `docs/TESTING.md`. If you find yourself copying a command list into a second document — link instead.
- Historical facts are frozen in `docs/ROADMAP_RECOVERY.md` / `CHANGELOG.md`; living state in `PROJECT_STATUS.md`. Don't blend them.

## 4. Conflict Resolution (between documents)

1. Execution/status claims: `PROJECT_STATUS.md` wins over everything else (including `docs/ROADMAP.md` phase checkboxes and stale sections of `docs/ARCHITECTURE.md`).
2. Technical decisions: newest non-superseded ADR wins; `docs/DECISIONS.md` is the index.
3. Historical claims: `docs/ROADMAP_RECOVERY.md` (evidence-based) wins over recollection and over older narrative docs.
4. Discovered conflicts are recorded (recovery §7 pattern), then fixed at the owner document's next scheduled update — never silently.

## 5. Document Hygiene Rules

- No secrets, tokens, `.env` content, or credentials in any document (seed demo accounts are publicly tracked; still avoid reproducing passwords).
- No agent/harness/tool names as contributors anywhere (Contributor Identity Rule — `AGENTS.md`; enforcement: `docs/TESTING.md`).
- Persian is the product/user-facing documentation language; English is used for agent/orchestration-facing state documents (this set). Either language is acceptable for new docs, but be consistent within one document.
- Every new document must be registered here (§1) and, if user/agent-facing, in `docs/README.md`'s map.
