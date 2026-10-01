# forge-ops — story-driven board for agent sessions

Branch `main`. Complete rewrite: the unit of work is no longer the task, it is the **story**, always accompanied by its **twin test story**. The board orchestrates Claude Code sessions on those stories and refuses to let a story move forward without proof.

**Look at it without installing anything:** [techmefr.github.io/forge-ops](https://techmefr.github.io/forge-ops/) — the demonstration board, frozen, with its guided tour in seven languages. Nothing runs there; it is a visit, not a trial. A presentation page, in the same seven languages, is at [techmefr.github.io/forge-ops/about](https://techmefr.github.io/forge-ops/about/).

**Install the desktop app:** Windows, macOS and Linux installers are on the [releases page](https://github.com/techmefr/forge-ops/releases/latest). The app updates itself, signs in with Google or Microsoft, and keeps a list of servers you can switch between. See [the desktop app](#the-desktop-app).

![The board: stories in their columns, coloured by project, with blocked and waiting-for-you cards marked](frontend/public/screenshots/board.png)

It speaks French, English, German, Spanish, Italian, Portuguese and Chinese, in six colour themes (light and dark) and four text sizes, down to a phone screen.

**Where this is going.** A rework was decided on 2026-09-18: the tool splits into a shared server and an executing instance, the interface comes down to four screens, the kanban columns become a template an organisation writes for itself, and the agent behind a card becomes a driver. [docs/Architecture.md](docs/Architecture.md) says what is being built and why; [docs/Deployment.md](docs/Deployment.md) says how it is run. This README describes what exists today — section 11 is the honest state of it.

## 0. What it looks like

| | |
|---|---|
| ![Subjects: every project with its weather, late and unassigned subjects, the team's load](frontend/public/screenshots/subjects.png) **Subjects** — every project at a glance, who took what. | ![Roadmap: subjects as bars on a timeline](frontend/public/screenshots/roadmap.png) **Roadmap** — what a project manager shows at the daily. |
| ![My forge: personal indicators and the kanban of my stories](frontend/public/screenshots/my-forge.png) **My forge** — your epics, your files, what your machine can still take. | ![Writing stories with Claude: pick an epic, Claude drafts the cards](frontend/public/screenshots/stories.png) **Stories** — pick an epic, write with Claude, then the twin test story. |
| ![Statistics: sessions, cost, machine time, most used agents](frontend/public/screenshots/statistics.png) **Statistics** — what it costs and where it goes. | ![Settings: palette, mode, font, text size](frontend/public/screenshots/settings.png) **Settings** — six palettes, light and dark, four fonts, four sizes. |

| Volt | Dracula | Nord |
|---|---|---|
| ![Volt](frontend/public/screenshots/theme-volt.png) | ![Dracula](frontend/public/screenshots/theme-dracula.png) | ![Nord](frontend/public/screenshots/theme-nord.png) |
| **Gruvbox** | **Tokyo Night** | **Solarized** |
| ![Gruvbox](frontend/public/screenshots/theme-gruvbox.png) | ![Tokyo Night](frontend/public/screenshots/theme-tokyo.png) | ![Solarized](frontend/public/screenshots/theme-solarized.png) |

<p align="center">
  <img src="frontend/public/screenshots/mobile-board.png" alt="The board on a phone" width="240" />
  <img src="frontend/public/screenshots/mobile-forge.png" alt="My forge on a phone" width="240" />
</p>

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
- **Reservation, not a bare hash.** The branch name's hash only seeds a candidate port; the repository walks the range from there, checking both the `port_reservation` table and whether the port actually binds, and reuses a worktree's held port when it is still free. A hash alone collides by birthday paradox well before the range fills up.
- **The last gate is human.** No agent moves a story to `done`.

## 3. Work hierarchy

A director writes **epics only**: the high-level business need. The AI architects decompose the epic into functional stories, each with its test twin. The story goes all the way down to the code.

```
project ─┬─ tag, link, event, risk, decision, weather
         └─ epic ─┬─ tag, link, event, state history
                  └─ story (functional) ─── twin_of ──→ story (test)
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
| `/TEST` | `tests_written` | `evidence/<REF>/tests.md` — the **red** tests, output pasted in |
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
| `GET /api/epics` | The subjects of every project; filters `project`, `assignee`, `state`, `tag`, `q` |
| `POST /api/epics` | Creates a subject |
| `PATCH /api/epics/:id` | Edits a subject: title, priority, start date, status note, requester, tags, links, dependencies, manual state |
| `DELETE /api/epics/:id` | Moves a subject to the trash (soft delete) |
| `POST /api/epics/:id/restore` | Takes a subject back out of the trash |
| `GET /api/epics/:id/history` | The state changes of a subject, with who and when |
| `PUT /api/epics/:id/assignee` | Sets the assignee of a subject |
| `POST`/`DELETE /api/epics/:id/claim` | Takes or releases a subject |
| `GET /api/projects/:id/epics` | The subjects of one project |
| `GET /api/tags` | The tags |
| `POST /api/tags` | Creates a tag (label, colour) |
| `PUT`/`DELETE /api/tags/:id` | Renames, recolours or deletes a tag |
| `GET /api/projects/sheets` | The projects as settings sheets: colour, admin, links, usage |
| `GET`/`PUT /api/projects/:id/links` | A project's links; writing needs the project admin |
| `GET /api/projects/:id/follow-up` | The follow-up of a project: weather, risks, decisions, events |
| `PUT /api/projects/:id/weather` | Overrides the weather of a project; needs the project admin |
| `POST /api/projects/:id/risks` | Opens a risk on a project |
| `PATCH /api/risks/:id` | Edits or closes a risk |
| `POST /api/projects/:id/decisions` | Records a decision on a project |
| `GET /api/projects/:id/events` | The events of a project in a `from`/`to` window |
| `POST /api/events` | Creates an event (type, date, title, project) |
| `PATCH`/`DELETE /api/events/:id` | Edits an event and its minutes, or deletes it |
| `GET`/`POST /api/projects/:id/workflow-columns` | Reads the workflow of a project, or adds a step; adding needs the project admin |
| `PUT /api/projects/:id/workflow-columns/order` | Reorders the steps; needs the project admin |
| `PUT`/`DELETE /api/projects/:id/workflow-columns/:columnId` | Edits or removes a step; needs the project admin |
| `GET /api/forge-cards` | Lists the forge cards of a project (`project` query) |
| `POST /api/forge-cards/backlog` | Adds a story to the backlog of a subject you hold |
| `POST /api/forge-cards/:id/move` | Moves a card to a workflow step |
| `POST /api/forge-cards/:id/launch` | Launches the agent of the card |
| `POST /api/forge-cards/:id/done` | Closes the card and unblocks what waited on it |
| `POST /api/forge-cards/:id/worktree` | Opens a worktree for the card |
| `GET`/`POST /api/board-users` | Lists the accounts, or enrols one (director or super admin) |
| `PATCH /api/board-users/:login` | Changes capacity, active flag or super admin flag (the last needs a super admin) |
| `POST /api/board-users/:login/verify-email` | Marks the email of an account as verified |
| `POST /api/board-users/:login/erase` | Erases an account; super admin only |
| `GET /api/board/self` | The signed-in login and whether it is a super admin |

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

### Registering an external project

A project checkout other than forge-ops itself needs the same guardrails, with absolute paths to this forge-ops install:

```bash
npm run guardrails:install -- /path/to/project-checkout
```

or `POST /api/projects/:id/guardrails` (project administrator). It writes the `PreToolUse` DenyHook and ScopeHook into the checkout `.claude/settings.json` (no secret, can be committed so worktrees carry it) and the `PostToolUse` hook with its token into `.claude/settings.local.json` (keep it out of version control). Existing settings are preserved and the command is idempotent. Without these hooks the board refuses to start a session (`409 GuardrailNotRegisteredError`).

The step prompts embed the doctrine text (`SPEC.md`, `BUILD.md`, ...) read from the project `.claude/commands/` when it ships one, otherwise from the forge-ops install, so the project needs no command files.

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
| `npm run guardrails:install -- <checkout>` | Registers the guardrail hooks on an external project checkout |
| `npm test` | Full suite (vitest) |
| `npm run build` | Compiles the TypeScript |

| Variable | Default |
|---|---|
| `FORGE_PORT` | `8830` |
| `FORGE_DB_PATH` | `forge.db` |
| `CLAUDE_CONFIG_DIR` | `~/.claude` |
| `FORGE_SESSION_CAP` | `3` |
| `FORGE_HOST` | `127.0.0.1` |
| `FORGE_TRUST_PROXY` | `false` (`true` only behind a reverse proxy that sets `X-Forwarded-For`) |
| `FORGE_ALLOW_REMOTE_LOCAL` | `false` (`true` lets local mode listen on a non-loopback host, only when the port is published on the loopback) |
| `FORGE_SETUP_TOKEN` | empty (when set, first enrolment needs it in the setup token header) |
| `FORGE_SUPER_ADMIN_LOGIN`, `FORGE_SUPER_ADMIN_PASSWORD` | empty (bootstraps the super admin; `FORGE_SUPER_ADMIN_PASSWORD_FILE` reads the password from a file instead) |
| `FORGE_TOKEN_PATH` | `.forge-token` |
| `FORGE_MODE` | `local` (`hub` to require an identity) |
| `FORGE_WORKTREE_ROOT` | `../forge-worktrees` |
| `FORGE_SHOT_DIR` | `../forge-shots` (screenshots of the piloted browser) |
| `FORGE_PILOT_HEADED` | `false` (`true` to see the Chromium on screen) |
| `FORGE_OTEL_METRICS_URL` | empty — without it, the resources screen says it has no collector |
| `FORGE_PUBLIC_ORIGIN`, `FORGE_OIDC_*` | see *Signing in with Google or Microsoft* |

### The desktop app

Installers for Windows (`.exe`, `.msi`), macOS (Apple Silicon `.dmg`) and Linux (`.AppImage`, `.deb`, `.rpm`) are attached to every [release](https://github.com/techmefr/forge-ops/releases/latest). The app wraps the same web front; nothing about the board changes.

- **It updates itself.** It reads `latest.json` from the latest GitHub release and installs signed updates, like a chat client. The public half of the signing key is in `src-tauri/tauri.conf.json`.
- **It keeps a list of servers.** The first launch asks for the address of an instance (your laptop, your VPS, your team's server) and an optional board server. The menu in the header adds, removes and switches servers; each one keeps its own session.
- **It lives in the system tray**, closes to the tray, and can start at login.
- **Signing in with Google or Microsoft** opens your system browser and comes back to the app through a `forgeops://` link.
- Only servers in hub mode are supported from the app today.

Maintainers publish a release by pushing a `v*` tag: `.github/workflows/desktop.yml` builds the three platforms and uploads the installers and the updater manifest. The repository needs the secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. A manual run of the workflow builds without publishing.

### Versioning

Versions follow [semver](https://semver.org/) and stay in 0.x until the project is declared stable. The version lives in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` and must match the tag. Pushing a tag `vX.Y.Z` triggers the desktop release workflow. See [CHANGELOG.md](CHANGELOG.md).

```bash
npm run desktop:dev      # app in development
npm run desktop:build    # local installer (needs Rust and the Tauri system libraries)
```

### Guided setup

```bash
npm run forge-ops -- init      # where do the agents run? writes secrets and docker/.env, offers to start compose
npm run forge-ops -- doctor    # docker, secrets, instance health, with a hint for each failure
```

`init` asks for the topology, the folder holding your repositories, the addresses, the first super admin, the email domains allowed to create an account on first sign-in, and the Google and Microsoft client settings (it prints the exact redirect URI to register). Secrets are written with mode `0600` and an existing secret is never overwritten; the generated admin password is shown once.

### Signing in with Google or Microsoft

Set the provider variables on the process that holds the accounts (the `server`, or the `instance` when there is no server). A provider is enabled only when both its client id and its secret are set, and its button then appears on the sign-in screen.

| Variable | Meaning |
|---|---|
| `FORGE_PUBLIC_ORIGIN` | The address people reach the board at; the redirect URI is `<origin>/api/auth/oidc/<google or microsoft>/callback` |
| `FORGE_OIDC_GOOGLE_CLIENT_ID`, `FORGE_OIDC_GOOGLE_CLIENT_SECRET` | Google OAuth client (the secret may come from `…_CLIENT_SECRET_FILE`) |
| `FORGE_OIDC_MICROSOFT_CLIENT_ID`, `FORGE_OIDC_MICROSOFT_CLIENT_SECRET` | Microsoft Entra app (or `…_CLIENT_SECRET_FILE`) |
| `FORGE_OIDC_MICROSOFT_TENANT` | A **specific tenant id**. `common` and `organizations` are refused: Microsoft does not vouch for the email there |
| `FORGE_OIDC_ALLOWED_DOMAINS` | Comma-separated email domains whose holders get an account on first sign-in (architect role) |

The flow is authorization code with PKCE, state and nonce. An account is found by its provider subject, else linked to the existing account with the same verified email, else created when its domain is allowed, else refused.

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
| Desktop app (Windows, macOS, Linux) with self-update, tray and a list of servers | Done, built and released by CI; install and update flow not yet exercised on every OS |
| Sign-in with Google and Microsoft, on the web and from the desktop app | Done and unit tested; not yet run against real provider credentials |
| Guided setup (`forge-ops init`, `doctor`) | Done; `init` not yet run on a real VPS |
| Seven interface languages (fr, en, de, es, it, pt, zh) | Done; Chinese is a first translation, a native review is welcome |
| Layout on phone widths and every text size | Checked with a headless browser across widths, sizes and palettes |
| Presentation page in seven languages | Done, served with the demo at `/about/` |

The architecture being built towards is in [docs/Architecture.md](docs/Architecture.md) and the ways to run it in [docs/Deployment.md](docs/Deployment.md). The step-by-step survey of the existing tooling is in [docs/Tooling.md](docs/Tooling.md), and the exhaustive listing of the landscape — around 120 projects, licenses and mechanisms — in [docs/Landscape.md](docs/Landscape.md). What the tool stores about people, and how to erase it, is in [docs/Privacy.md](docs/Privacy.md).

## 12. Licence

forge-ops is free software under the **GNU Affero General Public License v3.0** - the full text is in [LICENSE](LICENSE).

Copyright (C) 2026 Gaetan Compigni.

Running it, modifying it and hosting it are allowed. Running a modified copy as a service carries one obligation: publish the modifications. Contributions are covered by the same licence and are signed off under the Developer Certificate of Origin - see [CONTRIBUTING.md](CONTRIBUTING.md).
