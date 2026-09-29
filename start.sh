#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"

export FORGE_DB_PATH="${FORGE_DB_PATH:-forge-demo.db}"
export FORGE_WORKTREE_ROOT="${FORGE_WORKTREE_ROOT:-/tmp/forge-worktrees}"
export FORGE_SHOT_DIR="${FORGE_SHOT_DIR:-/tmp/forge-shots}"
log="${FORGE_LOG:-/tmp/forge.log}"
pidfile="${FORGE_PIDFILE:-/tmp/forge.pid}"

if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
  kill "$(cat "$pidfile")"
  sleep 2
fi

setsid node --import tsx backend/src/forge.ts > "$log" 2>&1 < /dev/null &
echo $! > "$pidfile"
sleep "${FORGE_START_WAIT:-9}"
tail -2 "$log"
