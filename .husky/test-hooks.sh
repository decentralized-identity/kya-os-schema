#!/usr/bin/env sh

# Behavioral tests for the commit-message hooks. Run locally and in CI to prove
# the git-hygiene gate rejects DCO-less and attribution-bearing messages and
# accepts a clean signed message. Exits non-zero if any case regresses.

set -u
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0

expect() { # <label> <expected-exit> <actual-exit>
  if [ "$2" -eq "$3" ]; then
    echo "ok   - $1"
  else
    echo "FAIL - $1 (expected exit $2, got $3)"
    fail=1
  fi
}

# 1. clean message with sign-off -> accepted
printf 'chore: initialize scaffold\n\nSigned-off-by: Dylan Hobbs <dylan.hobbs@vouched.id>\n' > "$tmp/clean"
sh "$here/commit-msg" "$tmp/clean" >/dev/null 2>&1
expect "clean signed message accepted" 0 $?

# 2. missing sign-off -> rejected
printf 'chore: no signoff\n' > "$tmp/nosig"
sh "$here/commit-msg" "$tmp/nosig" >/dev/null 2>&1
expect "missing sign-off rejected" 1 $?

# 3. Co-Authored-By assistant -> rejected
printf 'feat: x\n\nSigned-off-by: Dylan Hobbs <dylan.hobbs@vouched.id>\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\n' > "$tmp/coauthor"
sh "$here/commit-msg" "$tmp/coauthor" >/dev/null 2>&1
expect "assistant co-author rejected" 1 $?

# 4. generated-with footer -> rejected
printf 'fix: y\n\nGenerated with Claude Code\nSigned-off-by: Dylan Hobbs <dylan.hobbs@vouched.id>\n' > "$tmp/genwith"
sh "$here/commit-msg" "$tmp/genwith" >/dev/null 2>&1
expect "generated-with footer rejected" 1 $?

# 5. prepare-commit-msg scrubs an injected attribution trailer
printf 'feat: z\n\nCo-authored-by: Claude <noreply@anthropic.com>\nSigned-off-by: Dylan Hobbs <dylan.hobbs@vouched.id>\n' > "$tmp/scrub"
sh "$here/prepare-commit-msg" "$tmp/scrub" >/dev/null 2>&1
if grep -qiE 'claude|anthropic' "$tmp/scrub"; then
  echo "FAIL - prepare-commit-msg left attribution in place"; fail=1
else
  echo "ok   - prepare-commit-msg scrubbed attribution"
fi

[ "$fail" -eq 0 ] && echo "All git-hygiene hook tests passed." || echo "Git-hygiene hook tests FAILED."
exit "$fail"
