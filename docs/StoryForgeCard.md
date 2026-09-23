# Story and Forge Card

The target shape for turning a backlog into running agent work, decided on 2026-09-24. Three dependent changes, built in the order below: the split itself, then the continuous conversation it enables, then the multi-provider driver it requires.

## 1. Two entities where there was one

Today a story's `state` **is** its kanban column: `backlog`, `architecture`, `building`, `gating`... A story that gets worked on moves itself through `KANBAN_COLUMNS`. That conflates two different things: the spec (what must be true when this is done) and the work session that makes it true (which worktree, which conversation, which agent turn we're on).

Split them.

- **Story** stays what it already mostly is: title, body, acceptance criteria, its own test story ([[convention_osdd_functional_layer]] territory - the twin-story pattern already lives in `Story.ts`). Written through speckit. A story only ever has two states: `drafting` and `backlog`. It carries no worktree, no agent, no session.
- **Forge Card** is new: born from one or more stories picked out of the backlog. It owns the worktree (1:1, as today's `Worktree` keyed by id already assumes), the running session, and its position in the admin-defined workflow columns (`WorkflowColumn` - already free-form since #162/#168). Double-clicking it opens the same `CardDrawer` that exists today; the conversation it shows is the card's, not a story's.

A story can only belong to one open Forge Card at a time - picking it into a card removes it from the backlog selection pool until the card closes (merged, or explicitly abandoned).

## 2. Backlog selection, not backlog automation

Nothing in the backlog moves on its own. A person selects N stories and presses "Lancer une forge"; that creates the Forge Card, allocates the worktree against the first workflow column, and the launch order carries every selected story's id, title, body and acceptance criteria as the opening context - not just one story's.

This replaces the implicit 1-story-1-card assumption everywhere `StoryId` is threaded through `Dispatch`, `Worktree`, `MergeCleanup` today. Those become `ForgeCardId`. `MergeCleanup` doesn't change shape - it still releases scope and closes one worktree - it just closes the card's worktree and marks every bundled story `done` in the same transaction.

## 3. One conversation, not one per column

Today `SdkSessionRunner.launch` starts a brand new `query()` on every phase change - a fresh `claudeSessionId`, no memory of the previous column's turns. Evidence-on-disk (`CHECKPOINT.md`, proof files) carries continuity between phases today; the model itself doesn't.

Change `launch` to resume when the card already has a session: pass the Claude Agent SDK's `resume: <claudeSessionId>` instead of opening a bare `query()` whenever a Forge Card enters its second-or-later column. Column-specific configuration (agent name, skill, preprompt, model) still applies per turn - resuming a session doesn't lock the model or the system prompt, only the transcript and its context. `FORGE_PHASE` keeps changing per column as it does today; `FORGE_STORY_REFERENCE` becomes the card's reference, carrying every bundled story id.

Practical effect: open the drawer on a card that's three columns in, and you see the whole thing - the architecture discussion, the build turns, the review comments - as one scrollback, because it is one session.

## 4. One provider per card, not per column

This is the constraint the continuous conversation puts on the multi-provider driver ([#107](https://github.com/techmefr/forge-ops/issues/107), previously paused): a session's resume mechanism is provider-specific - a Claude Agent SDK session id means nothing to Codex or OpenCode. So the **provider is chosen once, at "Lancer une forge" time**, for the whole card's lifetime. Per-column configuration (agent, skill, preprompt, model, effort) still varies column to column; the driver underneath does not.

`SessionRunner` (`launch: (order) => Promise<{ claudeSessionId }>`) is already the right seam - it's the one Claude-specific implementation (`SdkSessionRunner`) that needs siblings, not a redesign. Each provider gets its own `XxxSessionRunner` behind the same interface; a `DriverRegistry` resolves which one a Forge Card uses from the provider chosen at launch. Providers that don't support resumable sessions (if any turn out not to) degrade to feeding prior transcript back into the prompt rather than a native resume - a fallback, not the default path.

## Delivery order

1. **Story / Forge Card split** - schema and domain change, no behavior change in what an agent does. Ships first because everything else is built on top of `ForgeCardId`.
2. **Continuous conversation** - `resume` wiring in `SdkSessionRunner`, drawer shows one scrollback. Ships against Claude only; proves the model before the driver abstraction has to support it N times.
3. **Multi-provider driver** - `SessionRunner` siblings for Codex, OpenCode, Hermes agent (or whichever is next), provider picker at launch time.

Each step gets its own implementation plan and PR. Step 2 cannot start until step 1 lands (`launch` needs a stable `ForgeCardId` to key resumption on); step 3 cannot start until step 2 proves what "resume" has to mean.
