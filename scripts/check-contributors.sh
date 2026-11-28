#!/usr/bin/env bash
# Contributor Hygiene Test (spec: docs/TESTING.md §4.1; policy: ADR-0013)
# Fails if any commit author/committer identity in the full Git history is not
# in the allowlist below. Report-only: this script never rewrites history.
#
# Allowlist rationale (decisions recorded 2026-11-28, docs/adr/0013-*):
#   1. Canonical maintainer identity — matches `git config` and the 44 non-merge
#      author/committer slots in history.
#   2. Web-flow pair — standard GitHub squash-merge artifacts on the 22 PR-merge
#      commits (author = the maintainer's GitHub web identity, committer = the
#      GitHub web-flow account).
#   3. zwork <zwork@local> — accepted as historical (commit f8cea70, 2026-11-03,
#      landed via PR #9; +1 Co-authored-by trailer in 2502332); display unified
#      via .mailmap. No history rewriting — dates and SHAs stay untouched.
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository." >&2
  exit 2
fi

ALLOWED=(
  "Mohammadreza Montajebi <mohammad.montajebii@gmail.com>"
  "M0nt <67793307+montajebii@users.noreply.github.com>"
  "GitHub <noreply@github.com>"
  "zwork <zwork@local>"
)

# Exact whole-line fixed-string matching: an identity only passes if name AND
# email both match an allowlist entry verbatim.
pattern_args=()
for identity in "${ALLOWED[@]}"; do
  pattern_args+=( -e "$identity" )
done

BAD=$(git log --all --format='%an <%ae>%n%cn <%ce>' | sort -u | grep -v -x -F "${pattern_args[@]}" || true)
if [ -n "$BAD" ]; then
  echo "Unauthorized contributor(s) found:"
  echo "$BAD"
  echo "Allowlist policy: docs/adr/0013-contributor-identity-and-web-flow-policy.md (new identities require an ADR amendment; no history rewriting)."
  exit 1
fi

echo "Contributor hygiene: OK (every author/committer identity is allowlisted per ADR-0013)."
