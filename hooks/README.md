# starfleet hooks

One hook, one job: give the dashboard a live activity feed without polling anything.

| Hook | Event | What it does |
|---|---|---|
| `starfleet-activity.sh` | `PostToolUse` | posts `{tool, filePath, worktreePath, session}` to `POST /api/activity` |

## Why a hook and not polling

Git tells you what a worktree *contains*, never who is working in it right now. The hook fires
once per tool call, so the dashboard learns three things at once: which worktree is alive, which
session is in it, and which file was just written. The same events double as a heartbeat — a
worktree with no event in the last five minutes is shown *idle*, because a dead session never
announces itself.

## What it never sends

The tool name, the file path, the working directory, the session id. **Not** the file content,
**not** the transcript, **not** the prompt. The transcripts under `~/.claude/projects/` stay the
place where history lives; starfleet stores the event, not the work.

## Wiring

In `~/.claude/settings.json` (or a project's `.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "/absolute/path/to/starfleet/hooks/starfleet-activity.sh" }
        ]
      }
    ]
  }
}
```

`STARFLEET_URL` overrides the dashboard address (default `http://localhost:4999`).

Widen the matcher to `Bash` too if you want commands in the feed; expect it to be noisy.

## Limits, stated honestly

- **The dashboard being down is not an error.** The script exits 0 whatever happens, and a
  one-second timeout caps the cost. A missed event means a worktree looks idle, nothing worse.
- **`worktreePath` is the tool's `cwd`**, so an event only attaches to a worktree whose path was
  recorded at creation. An agent running from the main repo lands in the feed unattached.
- **Nothing is authenticated.** The endpoint is meant for `localhost`; don't expose the dashboard
  port to a network you don't control.
- **It observes, it never blocks.** No hook here refuses a tool call — that's a different promise,
  and it belongs to whichever guard the repo already runs.
