# forge-ops — story-driven board for agent sessions

Branch `main`. Complete rewrite: the unit of work is no longer the task, it is the **story**, always accompanied by its **twin test story**. The board orchestrates Claude Code sessions on those stories and refuses to let a story move forward without proof.

## 1. The problem addressed

An agent coding on its own produces three classes of friction:

1. **Generated TDD can be mimicked.** A test written after the code, or modified to pass, costs more than no test at all: it reassures.
2. **The displayed state is not the real state.** An agent that crashes in the middle of a multi-file operation leaves a database that is consistent with itself and wrong with respect to the disk.
3. **Agents step on each other.** Two sessions touching the same file without knowing it produce a conflict discovered at merge time.

## 2. The decisions taken

- **One story, one test twin.** `story.kind` is either `functional` or `test`, and the twin points at the functional one through `twin_of_story_id`. A functional story does not leave `drafting` without its twin, and the board refuses the `spec_done` checkpoint without it. The scope is described across two objects, not one.
- **A step is proven by a file, never by an assertion.** Every checkpoint requires an `evidence_path` (`NOT NULL` in the database) pointing at a file under `.claude/evidence/<REFERENCE>/`. No proof, no checkpoint.
- **The sequence is ordered and the board enforces it.** A step crossed out of order, or twice, is refused with a 409. This is not a documented convention, it is a server-side refusal.
- **A single source of truth.** One SQLite database in WAL mode, read by the API and by the board. No duplicated state to synchronize.
- **The guardrail fails closed.** One `PreToolUse` hook carries two refusals — the deny list on `Bash|PowerShell`, the scope guard on `Edit|Write` — and blocks whenever it cannot decide: unreadable deny list, incomprehensible payload. The previous version failed open: deleting the script silently deleted all the protection.
- **File attribution comes from the hooks, not from a watcher.** Claude Code posts every `Edit`/`Write` to the API; the board knows which story touched which file and detects paths claimed by several stories.
- **Determinism rather than allocation.** Port and subdomain derived from a hash of the branch name: the conflict class disappears at the source.
- **The last gate is human.** No agent moves a story to `done`.

## 3. Work hierarchy

A director writes **epics only**: the high-level business need. The AI architects decompose the epic into functional stories, each with its test twin. The story goes all the way down to the code.

```
project → epic → story (functional) ─── twin_of ──→ story (test)
                   │
                   ├── acceptance_criterion
                   ├── story_dependency  (blocked, waiting on another one)
                   ├── checkpoint        (6 steps, each with its proof)
                   ├── agent_session → file_touch
                   └── review_finding    (quality | security | accessibility)
```

The full schema is in [db/forge.sql](db/forge.sql).

## 4. The sequence

Eight steps, six checkpoints. `/PLAN` and `/CODE-SIMPLIFY` have no checkpoint of their own: the first is proven by `arch_done`, the second is verified by the test suite already being green.

| Step | Checkpoint proven | Expected proof |
|---|---|---|
| `/SPEC` | `spec_done` | `evidence/<REF>/spec.md` — scope, acceptance criteria, out of scope, twin written |
| `/PLAN` | `arch_done` | `evidence/<REF>/arch.md` — breakdown, placement across the layers, risks |
| `/TEST` | `tests_written` | `evidence/<REF>/tests.md` — the **red** tests, the run referenced |
| `/BUILD` | `build_done` | `evidence/<REF>/build.md` — the same tests green, full suite |
| `/CODE-SIMPLIFY` | — | behavior unchanged, suite still green |
| `/VERIFY` | `verified` | `evidence/<REF>/verified.md` — the story's path walked for real |
| `/REVIEW` | `reviewed` | `evidence/<REF>/reviewed.md` — quality → security → accessibility cascade |
| `/SHIP` | — | human validation, then `done` |

**Rules that cannot be worked around:**

- `spec_done` is refused if the test twin does not exist, and refused if the story declares **no acceptance criterion**: with no criterion there is nothing to validate, hence nothing to block at merge.
- `reviewed` is refused as long as an acceptance criterion is unsatisfied, and a criterion is satisfied only **against a proof** — the test that covers it. No checkbox.
- `tests_written` must record a **behavioral** failure, not an import or setup error.
- `build_done` is refused as long as a mutation survives the suite (409 `MutationSurvivedError`): the board mutates the files the story touched and demands that the tests fall. A test that passes on its very first writing is validated there, not at `tests_written`.
- `reviewed` is refused as long as a `strong` finding is unresolved (409 `UnresolvedFindingError`). Lowering the severity to get through is not a fix.
- `/SHIP` rereads the full definition of done: a single step at `proven: false` and there is no delivery.
- Two identical failures in a row during `/BUILD` are a stop signal, not an invitation to retry.

The doctrine lives in [.claude/commands/](.claude/commands) and [.claude/skills/](.claude/skills), versioned alongside the code it governs rather than depending on an external plugin.

## 5. API

The board exposes an HTTP API (Hono). `POST /api/hooks` is also the target of the Claude Code hooks.

| Route | Effect |
|---|---|
| `POST /api/stories` | Creates a functional story |
| `POST /api/stories/:id/twin` | Writes its test twin |
| `POST /api/stories/:id/backlog` | Sends it to the backlog (refused without a twin) |
| `GET /api/stories/backlog` | Lists the backlog |
| `GET /api/stories/:id/ticket` | The whole ticket: functional side, test side, criteria, DoD, cascade |
| `POST /api/stories/:id/criteria` | Declares an acceptance criterion |
| `POST /api/criteria/:id/satisfy` | Satisfies a criterion against its proof |
| `POST /api/stories/:id/checkpoints` | Proves a step (`name`, `evidencePath`) |
| `GET /api/stories/:id/dod` | Definition of done: six steps, proven or not, with their proof |
| `POST /api/hooks` | Receives the Claude Code hooks, records the touched files |
| `POST /api/stories/:id/dispatch` | Starts a session on a phase (`phase`) |
| `GET /api/events` | SSE stream of the board's mutations |
| `GET /api/board/phases` | The contract of the phases and their prerequisites |
| `GET /api/files/conflicts` | Paths claimed by more than one story |
| `GET /api/fleet` | State of the agent sessions as read from Claude Code |
| `POST /api/stories/:id/scope` | Reserves a scope (folder and symbols) for a story |
| `DELETE /api/stories/:id/scope` | Gives back everything the story was holding |
| `GET /api/scope/reservations` | The scopes held, with the story holding them |
| `GET /api/scope/collisions` | The overlaps the board is subjected to |
| `GET /api/worktrees` | The live worktrees, their branch, their port and their subdomain |
| `GET`/`POST`/`DELETE /api/stories/:id/worktree` | Opens, reads or closes a story's worktree |
| `POST /api/stories/:id/pilot` | Starts a browser walkthrough (address, pace, steps) |
| `POST /api/stories/:id/pilot/advance` | Advances one step and records what it saw |
| `POST /api/stories/:id/pilot/pause` | Pauses the walkthrough, the browser stays open |
| `POST /api/stories/:id/pilot/resume` | Picks up where it left off |
| `POST /api/stories/:id/pilot/inspect` | Reads the current page without moving the cursor |
| `GET`/`DELETE /api/stories/:id/pilot` | The live walkthrough and its history, or dropping it |
| `GET /api/pilots` | The walkthroughs the board is watching right now |
| `GET /api/pilots/shots/:name` | The screenshot taken at a step, served as proof |
| `GET /api/machine` | The machine state read from the OpenTelemetry collector, or the reason for its absence |
| `GET /api/sessions/history` | The session history: duration, cost, exit class |
| `GET /api/statistics` | The totals, the most solicited agents, the time per step |
| `GET /api/incidents` | The reports coming from outside, filtered by state |
| `POST /api/origins/:slug/incidents` | Receives a report from a declared source |
| `POST /api/incidents/:id/accept` | Turns it into a story and its twin |
| `POST /api/incidents/:id/refuse` | Refuses the report, reason mandatory |
| `GET`/`PUT /api/settings/budget` | The cost cap and the conduct to follow when it is hit |

Return codes: `404` unknown story, `409` business refusal (sequence violation, missing proof, unresolved dependency, open `strong` finding), `500` only for a genuine unforeseen event — a business refusal never disguises itself as a server error, and neither does the reverse.

## 6. Execution guardrail

`.claude-deny.json` lists the commands that are never executed. The `PreToolUse` hook exits with code 2 along with its reason. It carries two responsibilities from the same entry point: the deny list on `Bash|PowerShell`, and the scope guard that refuses a write outside the scope reserved by the story on `Edit|Write`.

- It inspects the whole command **and every segment** separated by `&&`, `||`, `;`, `|` or a newline: `cd x && rm -rf y` no longer gets through.
- It **fails closed**: unreadable payload, missing command, deny list not found → refusal.
- `git push --force` and `-f` are blocked, `git push --force-with-lease` deliberately stays allowed.

## 7. API access

The threat is not the network, it is **the browser**: any page open in a tab can send requests to `127.0.0.1`. And `POST /api/stories/:id/dispatch` starts a session that writes into the repo and consumes the plan. Three defenses, in this order.

1. **The board listens on the loopback only.** `FORGE_HOST` is `127.0.0.1`. Only switch it to `0.0.0.0` once real multi-user authentication has been written.
2. **The origin is checked before anything else.** A request carrying an unknown `Origin` header leaves with a `403`, even with a valid token. That is what stops a web page, because a browser always sends `Origin` on a cross-origin request and cannot omit it.
3. **One token per board**, 32 random bytes, written into `.forge-token` (permissions `600`, gitignored) on first startup. Compared in constant time.

**The board token never travels in a URL.** A URL ends up in access logs, shell history, error traces and the `Referer` header: it is the worst place for a secret. So it is presented in `Authorization: Bearer`, in `X-Forge-Token`, or in the `forge_token` **cookie** — which `EventSource` sends on its own, which settles the SSE stream case without putting anything in the address. In development, the vite proxy sets the header on every call, stream included.

The board **refuses to start** if `.forge-token` exists but is empty, truncated or unreadable: no silent fallback without a token.

**No route is open without a secret**, the hook intake included. That said, the Claude Code hook cannot carry anything other than a URL. Rather than putting the board token in it, `POST /api/hooks` has **its own secret**, derived from the token by HMAC-SHA256: it opens the hook intake only, it allows neither reading the board nor starting a session, and it does not reveal the token it comes from. A leak in a log then costs no more than one touched-file record.

Its configuration therefore cannot be versioned. It lives in `.claude/settings.local.json`, gitignored and with permissions `600`, generated by:

```bash
npm run hook:install
```

`.claude/settings.json`, for its part, stays versioned and now contains only the `PreToolUse` guardrail, which needs no secret. Since hooks are read at session startup, Claude Code must be restarted after the installation.

Evidence paths are confined: `evidencePath` must live under `.claude/evidence/`, with no `..`, no absolute path, no backslash, no null byte. A `../../../.ssh/id_rsa` leaves with a `409`.

The `PostToolUse` hook on `Edit|Write|NotebookEdit` is of type `http` and posts to `POST /api/hooks`. Hooks are read at session startup: modifying `.claude/settings.json` only takes effect on the next session.

## 8. Installation and usage

### Prerequisites

- Node.js 22+
- Claude Code ≥ 2.1.224 for inter-session communication

```bash
npm install
npm run forge
```

### Demo on a fresh machine

A single command, from a fresh clone:

```bash
npm install
npm run demo
```

It does, in this order:

1. **creates a directory of its own for the run** and declares itself in demo mode — database, worktrees and screenshots all live inside that directory, and `FORGE_DB_PATH`, `FORGE_WORKTREE_ROOT` and `FORGE_SHOT_DIR` are never read, so a real board's variables cannot point the demo at a real database;
2. **erases the previous demonstration database** (`forge-demo.db` and its `-wal`/`-shm` files) — a second run never restarts from a half-advanced state. The erasure only ever touches a database carrying the demo mark (`board_setting.demo_database`, written when the run opens its database); on anything else it refuses, says so, and deletes nothing;
3. **seeds the database** with the demonstration board (projects, stories, zones, sessions);
4. **checks that the web bundle exists** in `dist/web` — the server serves `dist/` — and builds it if it is missing, saying so; if the build fails it stops with an error rather than serving an empty page;
5. **starts the board** and prints the address to open.

Opening the printed address is enough: the page sets the `forge_token` cookie and the board opens. The token is also printed in the clear in the terminal, on its own line, so the API can be queried by hand with `Authorization: Bearer` — **it never appears in a URL**, not even in the one that is printed.

The demonstration database and `.forge-token` are gitignored: none of it goes into git.

To pick a port other than `8830` (for example if a board is already running):

```bash
FORGE_PORT=8899 npm run demo
```

| Command | Effect |
|---|---|
| `npm run demo` | Fresh demonstration database, web bundle guaranteed, board started |
| `npm run forge` | Starts the board (schema applied at startup) |
| `npm run hook:install` | Writes the hook with its token into `.claude/settings.local.json` |
| `npm test` | Full suite (vitest) |
| `npm run build` | Compiles the TypeScript |

| Variable | Default |
|---|---|
| `FORGE_PORT` | `8830` |
| `FORGE_DB_PATH` | `forge.db` |
| `CLAUDE_CONFIG_DIR` | `~/.claude` |
| `FORGE_SESSION_CAP` | `3` |
| `FORGE_HOST` | `127.0.0.1` |
| `FORGE_TOKEN_PATH` | `.forge-token` |
| `FORGE_MODE` | `local` (`hub` to require an identity) |
| `FORGE_WORKTREE_ROOT` | `../forge-worktrees` |
| `FORGE_SHOT_DIR` | `../forge-shots` (screenshots of the piloted browser) |
| `FORGE_PILOT_HEADED` | `false` (`true` to see the Chromium on screen) |
| `FORGE_OTEL_METRICS_URL` | empty — without it, the resources screen says it has no collector |

## 9. Structure

One folder per side, OSDD within each: `technical/` never depends on `domain/`. The hub, when it comes, will be a mode of `backend/`, not a third folder. `contract/` sits beside them and depends on neither: it holds the shapes the API sends and the board reads, so the two sides cannot state the contract differently.

```
db/forge.sql                          SQLite schema (WAL)

contract/                             the wire contract, imported by both sides

backend/src/forge.ts                  entrypoint
backend/src/domain/Story/             story, twin, dependencies, backlog
backend/src/domain/Checkpoint/        the six steps and their proofs
backend/src/domain/Criterion/         acceptance criteria, merge gate
backend/src/domain/Agent/             agent sessions, touched files, conflicts
backend/src/domain/Zone/              file zones and path attachment
backend/src/domain/Dispatch/          phase contract, command file, cap, startup
backend/src/domain/Board/             the board's HTTP API
backend/src/domain/Budget/            cost cap and conduct to follow
backend/src/domain/Foremerge/         scope reservation and collisions
backend/src/domain/Identity/          accounts, sessions, hub mode
backend/src/domain/Incident/          outside sources and reports
backend/src/domain/Statistic/         session history and totals
backend/src/domain/Tamper/            test census before the review
backend/src/technical/Database/       SQLite connection
backend/src/technical/Http/           server, event bus, SSE stream
backend/src/technical/Guardrail/      deny list, decision, PreToolUse hook
backend/src/technical/ClaudeCode/     roster, jobs, session launcher (Agent SDK)
backend/src/technical/Network/        deterministic port and subdomain
backend/tests/                        mirror of backend/src/

frontend/index.html                   SPA host
frontend/src/technical/Api/           board client, event stream
frontend/src/technical/Router/        the nine pipeline screens
frontend/src/technical/Theme/         design tokens, themes, contrast
frontend/src/technical/Ui/            shared screen states
frontend/src/domain/Shell/            shell, navigation rail, active agents
frontend/src/domain/<Screen>/         one folder per screen
frontend/tests/                       mirror of frontend/src/

.claude/commands/                     the /SPEC … /SHIP sequence
.claude/skills/                       embedded methodology
.claude-deny.json                     commands never executed
```

## 10. Stack

- **Back**: TypeScript on Node + Hono, `better-sqlite3`, `zod`, vitest
- **Front**: Vue 3 + TypeScript + Vite, pure SPA — no Nuxt, no SSR — `vue-router`, Pinia for state only, shadcn-vue + Tailwind
- One process in production (the server serves `dist/`), two in development (`vite dev` proxies `/api`)

Low-level orchestration is not rewritten: it leans on the first party — the `claude agents` daemon, worktree isolation and the hooks — rather than on driving things by scraping the terminal.

## 11. Implementation state

| Building block | Status |
|---|---|
| SQLite schema and connection | Done |
| Story, twin, dependencies, backlog | Done |
| Six checkpoints proven by file | Done |
| Acceptance criteria blocking the merge, proven by file | Done |
| Two-sided ticket on a single route | Done |
| Review cascade and findings | Done, on the domain side |
| Agent sessions and file conflicts | Done |
| Board API and hook intake | Done |
| Deny guardrail (fail closed) | Done, hook wired in |
| Deterministic port and subdomain | Done |
| `/SPEC … /SHIP` doctrine aligned with the API | Done |
| Kanban states, points, rollout, merge conflict | Done |
| Review cascade by lens, ordered and blocking | Done |
| File zones with automatic summary and path attachment | Done |
| Readable design tokens (6 themes, light and dark) | Done |
| Dispatch of one session per story (Agent SDK) | Done |
| SSE to the board | Done |
| Scope reservation refused at write time and at startup | Done, plus a `PreToolUse` that refuses writing outside the scope |
| Accounts, sessions and hub mode | Done |
| Reports coming from outside, settled by a human | Done |
| Cost cap that cuts off, conduct of your choosing | Done |
| Session history and statistics | Done, read from the board's database |
| Front: router, shell and the nine pipeline screens | Done |
| Worktree lifecycle and port reservations | Done, against a real git, cleaned up after the merge |
| Fine-grained machine metrics | Done, read from an OpenTelemetry collector (`FORGE_OTEL_METRICS_URL`), never collected here |
| Feature flags | To be delegated to OpenFeature, the board keeps only the percentage |
| Browser piloting of step 6 (slow motion, pause, inspection) | Done, a real Chromium through `playwright-core`, screenshot at every step |

The step-by-step survey of the existing tooling is in [docs/Tooling.md](docs/Tooling.md), and the exhaustive listing of the landscape — around 120 projects, licenses and mechanisms — in [docs/Landscape.md](docs/Landscape.md).
