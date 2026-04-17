#!/bin/bash
# Auto-commit hook: runs when the Cursor agent stops.
# Stages all changes and creates a timestamped commit only if there is something to commit.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

# Nothing to commit → exit silently
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

git add -A

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
git commit -m "chore: auto-commit agent changes ($TIMESTAMP)"

exit 0
