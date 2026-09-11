# Landscape survey — features, not code

Survey of 2026-09-09. Six parallel reading passes over the categories of [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators), plus the direct competitors outside that list. Around 120 projects read through their README, product page and `LICENSE` file — never through their code. The "Personal Assistants" category is set aside: it touches none of the nine steps.

The nine steps serve as the grid: **1** story writing + twin · **2** backlog and batch dispatch · **3** architecture plan validated by a human · **4** kanban with blocking dependencies · **5** file view by zones and collisions · **6** driven browser test + cascading review · **7** one branch per story, merge queue, feature flags · **8** resources and cost · **9** session statistics.

---

## 1. Licenses — to settle before any dependency

A third of the landscape carries a license that forbids the competing product. These projects remain readable for their ideas; their **code** is out of reach if forge-ops is ever sold.

| Project | License | Effect |
|---|---|---|
| `amux` | MIT + **Commons Clause** | commercial resale forbidden |
| `AgentsMesh` | **BSL-1.1** → GPL-2.0+ on 2030-02-28 | paid commercial production use before that date |
| `loki-mode` | **BSL-1.1** → Apache-2.0 on 2030-03-19 | same |
| `Ivy-Tendril`, `collaborator`, `supacode` | **FSL-1.1-ALv2** | competing use forbidden for 2 years |
| `GraphCode` | **FSL-1.1-MIT** | same |
| `agent-kanban`, `NXTG-Forge Orchestrator` | **FSL-1.1** | same |
| `superset` | **Elastic License 2.0** | hosted service forbidden |
| `multica` | **in-house license** (Apache + clauses) | any instance exposed to third parties forbidden, even free of charge |
| `Claude Command Center` | **proprietary** since 2026-07-28 | MIT only before that date |
| `Better Agent` | source-available non-commercial | written authorization required |
| `constellagent`, `orc`, `handoff` | **no LICENSE file** | all rights reserved by default |

Strong copyleft, to watch without being blocking as long as we borrow no code: `claude-squad`, `openkanban`, `Ouijit`, `Proliferate`, `kandev`, `coder/mux`, `Fletch`, `Alethe`, `Aperant`, `Agent Teams`, `claude_codex_bridge`, `tlbx` (AGPL-3.0); `cmux`, `aizen`, `Garcon` (GPL-3.0, `cmux` explicitly offers separate commercial terms); `egoist/waku` (GPL-3.0).

Risk-free and directly mountable: `Concord MCP`, `guild`, `foremerge`, `Open Multi-Agent`, `aGiTrack`, `Archon`, `Crewplane`, `gastown`, `hcom`, `ORCH`, `paperclip`, `no_human`, `NEEDLE`, `sortie`, `symphony`, `Fusion`, `Vibe Kanban`, `claude-code-kanban`, `kanban-code`.

---

## 2. What nobody covers

Across the ~120 projects read, **none** does:

- **Step 1** — a story written together with its **test twin** at the same time. The closest are `LoopTroop` (a council of LLMs interviews the human to lift ambiguities, then generates a PRD and atomic units) and `Ivy-Tendril` (inline annotations on a draft plan that update the agent's goals). Nobody twins functional and test.
- **Step 5, the view** — everywhere, worktree isolation *stands in for* a file view. No project displays an emergent architecture by named zones with a summary.
- **Step 6, the named cascade** — nobody does quality → security → **accessibility**. Accessibility appears nowhere as a review lens.
- **Step 7, feature flags** — no project handles a progressive rollout. Nor a merge queue, in almost all of them.
- **The DoD proven per file** — verification gates exist everywhere, mandatory `evidence_path` nowhere.

That is the perimeter to build, and it is narrower and sharper than it was before this survey.

---

## 3. What the landscape does better than us

### Step 5 — collisions: five mechanisms, from weakest to strongest

1. `hcom` (MIT) — **notifies** when two agents edit the same file within a 30-second window. That is our current level: an after-the-fact observation.
2. `ORCH` (MIT) — **scope overlap detection before** the file collision. Preventive.
3. `Concord MCP` (MIT) — **reservation leases** with overlap detection at `start_work` time, an append-only ownership log, and review evidence bundles.
4. `foremerge` (Apache-2.0) — **semantic** reservation: the target is not a path but a `KIND:KEY=OPERATION` over 12 kinds (`symbol`, `api`, `schema`, `config`, `infra`, `test`, `migration`, `env`, `file`, `component`, `contract`, `domain`). Conflicts detected deterministically with severity, never by model judgment.
5. `NXTG-Forge Orchestrator` (FSL, blocked) — **exclusive file locks** between Claude Code, Codex and Gemini CLI on the same repo, tested against 378 concurrency scenarios.
6. `Zaivern Code` (Apache-2.0) — **line-range ownership** enforced at write time, finer than the file lock.

**Verdict.** Our `scope_reservation` by prefix and symbols sits at level 2-3. `foremerge` is one notch above and mounts **under** the board without taking the source of truth from it: its store is a SQLite in the `git-common-dir`, its 18 operations are exposed over MCP stdio, and accepting a changeset creates a git ref without ever merging. To be left without a cloud connector.

### Step 8 — cost and resources: already solved, several times over

- Claude Code emits cost, tokens and tool calls per session **natively** in OpenTelemetry.
- `repomon` (Apache-2.0) — computes cost **directly from the local transcripts**, with no billing API. Ledger per model and per repo.
- `aGiTrack` (Apache-2.0) — writes prompt, model and token-cost **into the commit message**. Traceability with no separate database.
- `agent-deck` (MIT) — cost/token dashboard over 15+ models with **budgets** and export.
- `paperclip` (MIT) — **a hard per-agent budget that cuts off** when exceeded. Not a display: a limit that acts.
- `fractal` (Apache-2.0) — USD cost ceilings at three granularities (run / iteration / step) with a 10% reserve.
- `Agent Teams` (AGPL) — CPU/RAM **on top of** tokens, per agent.

**Verdict.** Nothing to collect. We consume, and we add the single thing nobody has at our place: a ceiling that cuts off.

### Step 7 — merge queue

- `gastown` (MIT) — a **Bors-style queue with bisection** to isolate the faulty MR in a batch. The only serious example in the landscape.
- `dmux` (MIT) — **lifecycle hooks** create / pre-merge / post-merge, the clean extension point for wiring in a queue and flags.
- `Fusion` (MIT) — merge and destructive actions **always** subject to human confirmation, including in autonomous mode. A non-negotiable floor.
- `symphony` (Apache-2.0, OpenAI) — **"proof of work"**: a single bundle aggregating CI status, review feedback and analyses, presented to the human before merge.

**Verdict.** GitHub merge queue natively, pre/post-merge hooks for the rest, and symphony's "proof of work" is exactly the form our DoD screen before `/SHIP` should take.

### Step 6 — review

- `loki-mode` (BSL, blocked) — **8 quality gates**, blind review by 3 independent reviewers with blocking severity, a "devil's advocate" against complacency, fake-mock detection, and **"Evidence Receipts" that separate the deterministic fact from the AI judgment**.
- `no_human` (MIT) — **tamper guard**: mechanically counts deleted tests, added skips and tautological assertions before the review gate. And requires that the evidence tests **fail on the base** and pass on the new tree.
- `agent-kanban` (FSL, blocked) — a structural prohibition: **the assignee cannot approve their own submission**.
- `kodo` (MIT) — architect and tester must both approve, reassignment in a loop otherwise.
- `ralphex` (MIT) — a two-pass cascade, 5 parallel agents per axis (quality, implementation, tests, simplification, doc).
- `toryo` (MIT) — **quality ratcheting**: only results scored ≥ 6.0 are committed, the rest is rolled back.
- `Claudexor` (MIT) — Best-of-N with independent reviewers, a single winning patch applied.
- `cmux` (GPL) — a **scriptable browser pane** (DOM, forms, JS eval): the closest to our driven browser test.
- `agent-orchestrator` (Apache-2.0) — agent-driven browser with an **isolated profile per worker**.
- `CompanyHelm` (MIT) — **auto-generated demo video attached to the PR**.

**Verdict.** Three things to take: the tamper guard of `no_human` (mechanical, no judgment), the fact/judgment separation of `loki-mode` in the report to the human, and the rule "the assignee does not approve their own work".

### Step 4 — dependencies

- `guild` (Apache-2.0) — **cascading unblocking** of dependent tasks as soon as a blocker moves to `done`. Also in `ClawTeam` (MIT).
- `agent-kanban` (FSL) — dependencies with **cycle rejection**.
- `bernstein` (Apache-2.0) — **declarative** dependency conditions (`condition: status == 'done'`).
- `ai-maestro` (MIT) — kanban with explicit dependency tracking.
- `Fusion` (MIT) — kanban **plus a graph** of dependencies, `fusion/{task-id}` worktree.
- `Contrabass` (Apache-2.0) — `BlockedBy` gating and progress classification in 5 steps (Exploration → Editing → Testing → Reviewing → Wrapping) **derived from diff velocity**.

**Verdict.** We refuse `startBuilding` on an unresolved dependency. Missing are cycle rejection and cascading unblocking — two short additions.

### Steps 2 and 9 — intake and traceability

- `Claude Command Center` (proprietary) — **durable queues** drained in parallel by workers, with persistence of learnings.
- `NEEDLE` (MIT) — a SQLite queue with **atomic claiming**, and a state machine where **every** exit code (success, timeout, crash) has an explicit handler.
- `codecast` (MIT) — **`cast blame`**: trace back from a line of code to the session and the agent that wrote it.
- `Open Multi-Agent` (MIT) — an **offline Run Viewer** replaying timeline, dependencies, tokens and tool calls with no backend.
- `scion` (Apache-2.0, Google Cloud) — **normalized OTEL telemetry** across different harnesses.
- `MartinLoop` (Apache-2.0) — **locally signed execution receipts** and failure classification into 13 canonical classes.
- `ralph-claude-code` (MIT) — **completeness scoring** of an imported ticket: below 60/100, a plan is generated before launching anything.

**Verdict.** `cast blame` is already at our place in another form (`file_touch` → story). Completeness scoring is an intake filter we do not have, and `NEEDLE`'s exhaustive exit-code classification is the right model for our loop detection.

### Anti-loop guardrails

Few projects have serious ones. The best: `ralph-claude-code` (cuts off after 3 loops without progress or 5 with the same error, stagnation detection through a > 70% decline in output volume), `Dex` (4 iterations with no change in the number of remaining tasks), `ralphex` (`--review-patience`), `Contrabass` (`stall_timeout_ms` + capped backoff), `Orkas` (4 combined guardrails: turns, tools, loop, inactivity), `Loop Engineering` (**automatic confidence degradation** when the persistent state is more than 30 days old), `background-agents` (auto-pause after 3 failures).

---

## 4. Direct competitors

| Project | License | State | What it has that we do not |
|---|---|---|---|
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Apache-2.0 | **near-frozen** — company shut down ~April 10, 2026, last push 2026-04-24 despite the announced community takeover | test interface with an embedded browser and device emulation wired into the agent's workspace |
| [claude-code-kanban](https://github.com/NikiforovAll/claude-code-kanban) | MIT | active | **context window, tokens and cost shown on the kanban card** |
| [kanban-code](https://github.com/langwatch/kanban-code) | Apache-2.0 | active | session fork/checkpoint, BM25 search through history |
| [openkanban](https://github.com/TechDufus/openkanban) | AGPL-3.0 | active, young | kanban rendered in the terminal |
| [Ouijit](https://github.com/ouijit/ouijit) | AGPL-3.0 | active | **"Lenses"**: grouping changes by named instruction rather than by file |
| [Fusion](https://github.com/Runfusion/Fusion) | MIT | active, weekly | **adjustable oversight level** off / observe / steer / autonomous, with a non-negotiable floor on merge |
| [Aperant](https://github.com/AndyMik90/Aperant) | AGPL-3.0 | active | automatic conflict prevention between 12 parallel agents |
| [Fletch](https://github.com/fwdai/fletch) | AGPL-3.0 | beta | **deterministic plan→build→review→test workflow with verifiable completion conditions** |
| [Paseo](https://paseo.sh/) | Apache-2.0 | active, young, one maintainer | **iOS/Android mobile clients at parity and an end-to-end encrypted relay**, plus 30 agents other than Claude Code |
| [T3 Code](https://t3.codes/) | MIT | active, 21k+ stars, T3 Tools | **model switching mid-thread** and a **complete PR flow**: one-button creation with generated title and description, inline diff review before push, draft / stacked / amended PR |

The biggest competitor by name recognition has stopped. The two most active conceptually close ones, `claude-code-kanban` and `kanban-code`, are permissive and cover neither the twin story, nor the proven DoD, nor dependencies.

**Paseo is not a competitor, it is a lower layer.** It runs agent sessions and worktrees, it has no representation of the work: no story, no test twin, no definition of done, no zones, no review cascade. The overlap is limited to what we had already decided not to rewrite. Two ideas to take up later, not now: mobile clients at parity, and the end-to-end encrypted relay that would give remote access without breaking the loopback bind.

**T3 Code is the only one in the landscape that encroaches on work already done.** Like Paseo it holds the lower layer — sessions, worktrees, mobile — but it also carries the PR flow, hence step 7. Its name recognition and its MIT license make it the most credible candidate to take over that layer one day: it can be forked without constraint, which the AGPL competitors in the table forbid. Two reservations: its *stacked PRs* go against the rule "one story, one MR, never stacked", and it still covers neither the twin story, nor the proven definition of done, nor the zones, nor the quality → security → accessibility cascade. Not now, for the same reason as Paseo: we are not solving the same things.

**Name collision**: `jedarden/forge` is literally called "FORGE: Federated Orchestration & Resource Generation Engine", and `nxtg-ai/forge-orchestrator` carries "Forge" as well. The name is not free.

---

## 5. What we mount, what we stop, what we add

**To mount under the board, without ceding it the source of truth:**

- `foremerge` (Apache-2.0) — semantic collision engine for step 5. Local SQLite store, 18 MCP operations, cloud connector to be left disabled.
- Claude Code's OpenTelemetry — steps 8 and 9. Nothing to collect.
- GitHub merge queue + pre/post-merge hooks in the manner of `dmux` — step 7.
- Playwright MCP and the Browser pane — the browser driving of step 6.
- OpenFeature + Unleash or Flagsmith — the feature flags. The board keeps only the percentage.

**Traps not to mount:** `Agentlas OS`, `omnigent`, `openfang`, `NemoClaw` are meta-harnesses that want to own the whole loop — mounting them under the board would invert the balance of power. `Concord MCP` has **opt-out** telemetry, not opt-in: to be disabled explicitly if we embed it.

**Short additions, drawn from the survey:**

1. Dependency cycle rejection + cascading unblocking (`guild`, `agent-kanban`).
2. Tamper guard before the review gate: deleted tests, added skips, tautological assertions (`no_human`).
3. The assignee does not approve their own work (`agent-kanban`).
4. A cost ceiling that cuts off, not one that displays (`paperclip`, `fractal`).
5. Exhaustive classification of session exit codes (`NEEDLE`).
6. Completeness scoring of a story before launch (`ralph-claude-code`).
7. Separation of deterministic fact from AI judgment in the report to the human (`loki-mode`).
8. Tokens and cost shown on the kanban card (`claude-code-kanban`).

**What remains ours, confirmed by ~120 readings:** the story and its twin written together, the definition of done proven per file, the kanban that knows its dependencies, the file view by zones, and accessibility as a review lens in its own right.
