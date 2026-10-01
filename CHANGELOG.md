# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Autopilot: cards advance like a CI pipeline. The board reads a per-step verdict file and proves the checkpoint itself, retries a failed step (default 2, 0 to 5 per step), starts backlog stories when there is room, and pauses at a Human step, on a blocked agent, on budget exhaustion or on a stop. A card that cannot continue stops red with its reason.
- Automatic Done: when the last step passes, the card closes, the branch is pushed and a pull request or merge request is opened. Auto-merge is a separate switch, off by default. Settings are per project (`GET`/`PUT /api/projects/:id/autopilot`, project admin) and the Forge screen has an `auto` badge, with `Paused` and `Red` reasons on the card.
- Guardrail registration on an external project checkout: `npm run guardrails:install -- <checkout>` and `POST /api/projects/:id/guardrails`. The step prompts carry the doctrine from the project, else from the forge-ops install.
- A story worktree is opened when a card enters an agent step.
- `DELETE /api/stories/:id/talk` stops the Claude process and keeps the cost of the turn.

### Changed

- Agent sessions are decided by a permission callback: tools by phase, writes confined to the story directory, spec and architecture phases write only under `.claude/evidence/`. A session refuses to start unless the guardrail hooks are registered (`409 GuardrailNotRegisteredError`).
- Agent processes get an allow-listed environment instead of the board's.
- Worktrees, evidence and proofs are resolved from the project checkout, not from the board's directory.
- A card resumes its Claude session on the next step, and the cost of each turn adds to the session total.
- A card whose agent waits for a person can move on; a budget stop keeps the card in its step.

### Fixed

- Resuming a card session no longer fails with a unique session id error.
- The phase of default template steps is derived, so spec phases can write evidence.
- Minor bundle: deployment branch, event dates, stale state, a path leak, translations, thin stories.

### Security

- Request bodies are capped (1 MiB, 8 KiB under `/api/auth/`) before authentication.
- Sign-in is limited per client address and per login-and-client pair; `FORGE_TRUST_PROXY` selects whether `X-Forwarded-For` is read.
- Local mode refuses a non-loopback bind unless `FORGE_ALLOW_REMOTE_LOCAL=true`, and local automatic sign-in needs a local origin or a loopback peer.
- First enrolment can require `FORGE_SETUP_TOKEN`; budget policy writes need a director or super admin.

## [0.5.0]

Replaces the release mistakenly numbered 5.0.0.

### Added

- Projects and follow-up of their work.
- My forge personal board with kanban and pipeline views.
- Per-project workflow.
- OIDC sign-in (Google and Microsoft).
- Desktop shell with self-update, tray and server switching.
- Demo published on GitHub Pages.

### Security

- Security hardening of the server and the desktop app.

## [0.1.1]

### Fixed

- Patch release following 0.1.0.

## [0.1.0]

### Added

- First release of the forge-ops board.
