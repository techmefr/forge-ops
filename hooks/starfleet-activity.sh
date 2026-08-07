#!/usr/bin/env bash
# PostToolUse hook: posts one activity event to the starfleet dashboard.
# Sends {worktree, session, tool, file, ts} and nothing else — never the transcript,
# never the file content. Always exits 0: a dashboard that is down must never
# break the tool call that triggered this.

set -u

STARFLEET_URL="${STARFLEET_URL:-http://localhost:4999}"
PAYLOAD="$(cat)"

STARFLEET_URL="$STARFLEET_URL" python3 - "$PAYLOAD" <<'PY' 2>/dev/null
import json
import os
import sys
import urllib.request

raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    event = json.loads(raw)
except (ValueError, TypeError):
    sys.exit(0)

tool = event.get("tool_name")
if not tool:
    sys.exit(0)

tool_input = event.get("tool_input") or {}
file_path = tool_input.get("file_path") or tool_input.get("notebook_path")

body = json.dumps(
    {
        "tool": tool,
        "filePath": file_path,
        "worktreePath": event.get("cwd"),
        "session": event.get("session_id"),
    }
).encode("utf-8")

request = urllib.request.Request(
    os.environ["STARFLEET_URL"].rstrip("/") + "/api/activity",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(request, timeout=1).read()
except Exception:
    pass
PY

exit 0
