# ADR-0010 — CI install reliability: release-artifact node_modules

- **Status:** ACCEPTED
- **Date:** 2026-11-01
- **Tracks:** issue #4 (closed)

## Context

2026-10-30/11-01: `bun install` from GitHub runners stopped completing — first as
silent multi-minute stalls, then (measured) **>60 minutes for downloads-only**.
`bun install` is a known no-timeout staller on dead registry connections
([oven-sh/bun#29525](https://github.com/oven-sh/bun/issues/29525),
[#30002](https://github.com/oven-sh/bun/issues/30002),
[#25424](https://github.com/oven-sh/bun/issues/25424)). Local bun was healthy
throughout (1.3–700s depending on the hour), so the degradation was specific to
runner egress. Ruled out empirically: bun 1.4.4 and 1.2.23 (identical), npmjs and
npmmirror (identical), ubuntu-latest and ubuntu-22.04 (identical), retry/timeout
strategies (don't help against a black hole), `--ignore-scripts` (downloads
alone never finished). Meanwhile P3's identical install had passed in 28s.

A second, independent failure surfaced once installs were bypassed: the CI
runtime's Prisma engine detection reported `debian-openssl-1.1.x` (bun reports
`versions.openssl: "1.1.0"` — its BoringSSL compat string), so a
`debian-openssl-3.0.x`-only artifact 500'd on every DB query. Fixed by shipping
**both** engine variants (`binaryTargets = ["native", "debian-openssl-1.1.x"]`).

## Decision

1. **node_modules ships as a release asset.** `v0.3.0-deps` on GitHub Releases
   contains root + classroom-service `node_modules` (linux-x64 glibc, including
   the generated Prisma client with both engine variants). Both workflows
   restore it via `gh release download` (GitHub's own CDN — reachable when
   registries aren't) and skip install/generate entirely.
2. **Both Prisma engine variants** in `prisma/schema.prisma` `binaryTargets`
   (additive; `native` unchanged). This also future-proofs any deployment whose
   runtime probe differs from the build machine.
3. The ephemeral test server spawns under **real Node**, never under bun
   (`tests/helpers/server.ts`) — bun's openssl string poisons Prisma's probe.

## Consequences

**(+)** CI: 60m+ hangs → **31–56s total job time**; CI no longer depends on
registry egress at all; deterministic, reproducible environments.

**(-)** `bun.lock` changes require a manual artifact refresh (rebuild tarball
locally, `gh release upload v0.3.0-deps … --clobber`) or CI runs stale deps.
Forgetting = confusing "works locally, fails CI" drift. The restore step is a
~318MB download (~20–40s). Release asset is public (contains only public
packages — no secrets, verified).

## Migration plan (revert trigger)

When `bun install --frozen-lockfile` completes on a runner **7 consecutive
runs** (test by re-enabling a normal install step on a scratch PR):
1. Delete the restore step; restore the `bun install --frozen-lockfile` step.
2. Keep `binaryTargets` (correct for any openssl mismatch forever).
3. Delete the `v0.3.0-deps` release.
4. Close with a link back here.

## Review trigger

- bun upstream fixes the no-timeout stall (or 7 stable days pass), or
- any `bun.lock` change (artifact refresh — see Consequences), or
- a runner-restore failure (GitHub CDN issue — fall back to rerunning once,
  then investigate).
