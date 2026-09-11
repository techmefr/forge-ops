# What already exists, step by step

> First pass. The exhaustive survey — around 120 projects read, licenses checked, mechanisms compared — is in [Landscape.md](Landscape.md), which corrects and sharpens several of the conclusions below.

Survey of 2026-09-09. Question asked: for each step of the pipeline, does an existing tool cover the need better than code written here?

The landscape has exploded: the reference list `awesome-agent-orchestrators` counts more than a hundred projects, spread across parallel agents (TUI and desktop), multi-agent swarms, autonomous loops, ticket-triggered runners, and infrastructure primitives. The useful consequence: **almost everything that is plumbing is commoditized, and almost nothing covers the twinned story proven per file.**

## Verdict per step

| Step | What exists | Decision |
|---|---|---|
| 1. Story writing | Nothing. The closest projects (`cyrus`, `Contrabass`, `Open Session`, `sortie`) **consume** a ticket from Linear/GitHub/Slack, none writes one, and none knows about the test twin | **Build.** That is the differentiator |
| 2. Backlog and batch dispatch | Every board does it, none carries the twin or the dependencies | **Build** (little code) |
| 3. Architecture to validate | The pattern is validated elsewhere: `Dex` (planning under a human gate, multi-reviewer review), `Fusion` (plan → review → execution gates), `AGX` (checkpoints with a human gate between cycles), `Ivy-Tendril` (per-plan lifecycle with verification gates) | **Build**, keep `arch_done`. Ivy-Tendril is **FSL-1.1**: to read, not to depend on |
| 4. Kanban, worktrees, dependencies | The most saturated segment: `Vibe Kanban` (Apache-2.0, 26.4k stars, **project stopped in April 2026**, taken over by the community), `claude-code-kanban`, `Kanban Code`, `nimbalyst`, `Ghostex`, `kandev`, `Ouijit`. One worktree per task is a solved problem | **Do not rewrite the worktree plumbing**: the `claude agents` daemon already isolates under `.claude/worktrees/`. **Blocking dependencies between cards** are covered by nobody → build |
| 5. File view and collisions | The real find. `Concord MCP` (**MIT**) does reservation leases, edit collision detection and the passing of review evidence before the PR. `foremerge` does git coordination with declaration of intent and scope. `Fletch` and `Tempest` share a symbol index. `Zaivern` does line-by-line ownership | **Done**: the collision is still observed after the fact via `PostToolUse`, and a `PreToolUse` now **refuses** any write outside the prefix reserved by the story (`ScopeHook`), against `scope_reservation`. The `path_claim` table, which nobody was writing, has been removed from the schema |
| 6. Test and review | Browser driving: Playwright MCP, the Browser pane, Claude in Chrome. Cascading review: `loki-mode` (**BUSL-1.1**, review by three blind reviewers), `kodo` (independent verifier), `no_human` (**MIT**, review by a second model then human merge) | **Build nothing.** Drive the browser with the existing tooling, and wire in the mentis reviewers (quality, security, accessibility) rather than writing reviewers |
| 7. Deployment | Merge queue: **GitHub merge queue** natively, or `gastown` (a Bors-style queue). Feature flags: **OpenFeature** + Unleash or Flagsmith. Conflicts: `agent-orchestrator` repairs CI and conflicts, `Aperant` has a self-validating QA loop | **Adopt.** Never write a feature flag engine or a merge queue. The board keeps only the alert on the card |
| 8. Resources | Claude Code **already emits** cost and tokens per session in OpenTelemetry; `~/.claude/jobs/<id>/state.json` carries `tokens`. `agent-squid` displays a quota gauge, `Claudexor` does rotation according to quota | **Consume, do not collect.** Container cleanup: `docker prune` behind a merge hook |
| 9. Statistics | Entirely covered: Claude Code → OTLP → Prometheus/Grafana, or CloudWatch Coding Agent Insights. `aGiTrack` writes the token cost into the commit message, `codecast` records the sessions with attribution | **Do not build a stats database.** The board queries the existing source |

## License traps

Three tempting projects forbid the competing product, which disqualifies them as a dependency if forge-ops is ever sold:

- `amux` — MIT **+ Commons Clause** (commercial resale forbidden), and drives the agents by scraping tmux
- `Ivy-Tendril` — **FSL-1.1**, source-available, switches to Apache-2.0 after two years
- `loki-mode` — **BUSL-1.1**

Risk-free: `Concord MCP` (MIT), `Vibe Kanban` (Apache-2.0), `no_human` (MIT), `intentic` (MIT).

## What this survey changes

**Four things to build**, because nobody covers them: writing the story with its twin, the definition of done proven per file, the kanban that knows blocking dependencies, and the file view by zones.

**Four things no longer to plan on building**: the worktree plumbing (the daemon does it), the browser driving (Playwright and the Browser pane do it), the feature flags (OpenFeature), and the cost/duration/token telemetry (OTel natively).

**One clear improvement**: moving from collision detection to scope reservation refused at write time.

## Sources

- [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)
- [Vibe Kanban](https://vibekanban.com/)
- [Concord AI](https://getconcord.ai/) and [concord-mcp](https://github.com/Get-Concord-AI/concord-mcp)
- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)
- [Claude Code + OpenTelemetry, per-session cost and token tracking](https://bindplane.com/blog/claude-code-opentelemetry-per-session-cost-and-token-tracking)
- [Analyzing Claude Code usage with CloudWatch and OpenTelemetry](https://aws.amazon.com/blogs/mt/analyzing-claude-code-usage-with-cloudwatch-and-opentelemetry/)
- [9 Open-Source Agent Orchestrators for AI Coding](https://www.augmentcode.com/tools/open-source-agent-orchestrators)
