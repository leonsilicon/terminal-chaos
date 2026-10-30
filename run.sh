#!/bin/sh
set -eu
TASK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v node >/dev/null 2>&1; then
  exec node "$TASK_DIR/src/cli.ts" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun "$TASK_DIR/src/cli.ts" "$@"
else
  echo "Install Node.js 22.18+ or Bun to run Terminal Chaos." >&2
  exit 1
fi
