#!/usr/bin/env bash
# Stop hook: when Claude finishes a turn, run `tsc --noEmit` if any .ts/.tsx
# file has uncommitted changes. On type errors, exit 2 so the errors are fed
# back to Claude and it keeps working instead of stopping.
#
# Skips when:
#   - this stop was already triggered by this hook (avoid loops)
#   - no .ts/.tsx changes in the working tree
#   - the same set of changes already passed the last check (cached by hash)

input=$(cat)
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

changed=$(git status --porcelain --untracked-files=all -- '*.ts' '*.tsx' 2>/dev/null)
[ -z "$changed" ] && exit 0

cache=".claude/.typecheck-pass"
hash=$( { printf '%s' "$changed"; git diff HEAD -- '*.ts' '*.tsx' 2>/dev/null; } | git hash-object --stdin )
if [ -f "$cache" ] && [ "$(cat "$cache")" = "$hash" ]; then
  exit 0
fi

output=$(npx tsc --noEmit 2>&1)
status=$?
if [ $status -ne 0 ]; then
  {
    echo "TypeScript type check failed (npx tsc --noEmit). Fix these errors before finishing:"
    printf '%s\n' "$output" | head -40
  } >&2
  exit 2
fi

printf '%s' "$hash" > "$cache"
exit 0
