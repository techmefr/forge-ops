# The two-panel ticket and the remote platform

Design of 2026-09-09. Only the ticket route is written to date; the rest of this document settles the breakdown before the code.

## 1. The two-panel ticket

Today the functional story and its test twin are two rows of the `story` table. That is correct in the database and wrong on screen: they are **two panels of a single ticket**, not two cards.

- The kanban displays only `functional` stories. The twin never has a card of its own — it is already filtered out on the backlog side.
- The opened ticket carries two tabs: **Functional** and **Tests**. Same reference, `PS-1` and `PS-1-T`, a single object on screen.
- A single route serves the screen: `GET /api/stories/:id/ticket`, which returns the functional panel, the test panel, the definition of done and the review cascade. Acceptance criteria are still missing from it: the table exists, no repository writes it.
- The route answers to the identifier of either panel: asking for the ticket by the twin's reference returns the same object. The front end does not have to know which of the two it holds.

## 2. Writing in two stages

The order is imposed and it is already half the guardrail: **the tests cannot be thought through before the perimeter is written**.

1. The functional panel is written first. As long as it is not saved, the Tests tab is closed.
2. The test panel is written next: what we want to validate, not how. It is the answer to "what proves this is done".
3. `spec_done` is only provable once both panels are written. That is the existing server rule (`TwinRequiredError`); here it takes on its interface meaning.

The rest does not change: architecture, plan to validate, TDD red, dev green, QA, cascading review, merge, flag, production.

## 3. The intent is remote, the execution is local

Two deployments, two responsibilities that do not overlap.

**The hub, remote.** The director writes the projects and epics there, and assigns them. It carries the accounts, the assignments and the bug inbox. It knows nothing of sessions, evidence or touched files.

**The board, local, one per workstation.** It pulls what is assigned to it, feeds its backlog, launches the sessions, writes the checkpoints and keeps the evidence on disk. It reports back to the hub nothing but progress. The Claude Code doing the work is the workstation's own: the hub never launches a session and needs no API key.

What the hub serves the director, read-only: where each ticket stands, and who is responsible for it. Nothing else — no code, no evidence, no session.

**Two ways to get work, either one.** The director can assign an epic to somebody; conversely an unassigned epic can be taken by whoever wants it. Same rule for incidents. In both cases the take is recorded on the hub side and is exclusive: assigned or taken, it is the same lock, only the initiative changes.

| Object | Truth | Direction of flow |
|---|---|---|
| Account, project, epic, assignment | Hub | hub → local |
| Incident (bug, user feedback) | Hub | hub → local |
| Story, twin, criteria | Local | local → hub (summary) |
| Checkpoint, evidence, touched file, session | Local only | never reported up |
| Story state, rollout percentage | Local | local → hub |

Consequences to hold to:

- **Exclusive scope taking.** Assigned or taken, an epic has one owner and only one. The hub records who and at what time; an epic already taken comes back read-only for the others. It is the same class of problem as file collisions, solved in the same place: by a refusal, not by an alert.
- **Idempotence.** Every pulled object carries its `origin` and its `origin_id`. Pulling again duplicates nothing.
- **The hub does not see the evidence.** The `.claude/evidence/` files stay local. The hub learns that a step is proven, never its content — otherwise the platform becomes a code repository through the back door.
- **The local side works offline.** The hub goes down, the sessions carry on; the reporting catches up on return.

## 4. Bugs, outside the backlog

A bug is not a story, it is an **entry to triage**. The hub carries an inbox, and the source is interchangeable: Sentry, GlitchTip, another error collector, a user feedback form, manual entry. Every source reduces to three fields — a fingerprint, a title, a payload — and the triage knows nothing else. Sentry is the first one wired in, not the only one planned.

The cycle:

1. The source posts to the hub. The entry arrives in the `new` state, grouped by fingerprint so as not to create a hundred tickets from a single exception.
2. A human **accepts or refuses**. Nothing becomes a story without that validation — automating all the way to the story would amount to letting Sentry fill the backlog.
3. An accepted entry becomes a functional story in the target project, ready to be pulled.
4. The Tests panel of that story is the **non-regression test**: the bug reproduced first, red. That is exactly the TDD cycle; the Sentry entry supplies the red.
5. The story follows the full sequence. Nothing is cut short because it is a bug.
6. The merge ships to production **behind a feature flag**, with a progressive ramp-up. The collector watches the same fingerprint: no more occurrences on the enabled perimeter, we ramp up; it reappears, we drop back to zero without redeploying.

The loop closes: the production error becomes a ticket, the ticket becomes a session, the session comes back to production behind a flag watched by the source that reported the error.

## 5. Concurrent sessions

The starting point of everything: **while Claude works on one story, another is being prepared**. Which presupposes three things the board must hold.

- **One session per story**, launched from the card, not from a terminal. The Agent SDK drives it, the board keeps the identifier.
- **A capped number of simultaneous sessions**, and the cap is not decorative: beyond it, the launch is refused. The criterion is machine resources, not desire.
- **No session blocks the interface.** Writing one story while another is building is the normal case, not the exception.

And a cost ceiling per story, which **acts** instead of warning. What it does at the limit is not decided by the board: it is a person's setting, among three behaviors.

| Behavior | Effect at the limit |
|---|---|
| `stop` | The session is killed, the story moves to `escalated` with its reason |
| `downgrade` | The session restarts on a cheaper Claude model and carries on |
| `reroute` | The session restarts at another provider, through a router, and carries on |

None is the right default for everyone: `stop` protects a pay-as-you-go bill, `downgrade` protects a plan window, `reroute` protects nothing but never stops. The choice lives in the workstation settings, and a story can override it — a production fix does not stop because a generic ceiling was reached.

What is not a matter of choice: the limit applies. All three behaviors do something; none of them is "warn and carry on".

## 6. Two stacks, because the boundary is sharp

The local board stays **TypeScript on Node + Hono + `better-sqlite3`**. That is not negotiable: it is the one driving the sessions, and the Agent SDK exists only in TypeScript and in Python.

The hub goes with **Laravel + `lomkit/laravel-rest-api`**. It launches no session, needs no API key, and is nothing but multi-user CRUD with authentication, permissions, assignments and webhooks — that is, exactly what Laravel does without our writing anything at all. Socialite wires in Entra ID without writing an OIDC layer, lomkit serves the projects, epics and incidents with their filters with no bespoke endpoint, and mentis knows how to review Laravel: the hub is dogfoodable, which a hub in TypeScript would be no more than.

The price to pay, accepted: two toolchains, two deployments, and an HTTP contract to keep in sync between the two. It holds because the boundary — intent against execution — will not move.

OSDD on both sides, `technical/` and `domain/`, `technical/` never importing `domain/`.

## 7. What this adds in the database

On the local side, four changes:

- `epic` and `story` gain `origin` and `origin_id`.
- `epic` gains the assignment pulled from the hub, read-only.
- a local `incident` table, mirroring what has been pulled, to trace story → originating incident.
- nothing for `checkpoint`, `review_pass` or `file_touch`: they stay outside the hub.

On the hub side, a brand-new and much smaller schema: accounts, projects, epics, assignments, incidents, scope takes. No checkpoints, no sessions, no evidence.

## 8. Settled, and what remains open

- **The transport.** Pulling by HTTP call on demand, or an SSE subscription from the hub. The on-demand call is enough to start with and avoids exposing the local workstation.
- **Authentication.** Username and password to start, then SSO — Microsoft Entra ID first. Which means: identity is a separate table from day one, never a column on the account, and the password is one identity provider among others. One token per workstation for the local board, issued by the hub and revocable, independently of the human's sign-in mode.
- **The hub's storage.** SQLite as long as there is one director and one team; Postgres as soon as there are several organizations.
- **The name.** `forge-ops` stays, `main` is a branch name. Two public projects are already called Forge.
- **The license.** MIT to start with: it leaves us free to sell. It also leaves a competitor free to take the product as it is — to be reopened only if that becomes an issue.
