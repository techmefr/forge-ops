---
description: Write the story and its twin test story, before a single line of code
---

Step 1 of the forge-ops sequence (`/SPEC /PLAN /TEST /BUILD /CODE-SIMPLIFY /VERIFY /REVIEW /SHIP`). Related local skill: `spec-clarification`.

The unit of work is the **story**, not the branch nor the task. The board gives you in your dispatch prompt the reference and the identifier of the story you are working on. The board listens on `http://localhost:8830` (`FORGE_PORT`).

1. Clarify with the user what must be built: exact scope, acceptance criteria, what is explicitly out of scope. No code at this step.
2. Write the story: `POST /api/stories` with `epicId`, `title`, `body`. The board derives the reference from the project slug.
3. Write its **twin test story**: `POST /api/stories/:id/twin` with `title` and `body`. It states the cases to cover, not their implementation, and follows the test-casebook conventions.
4. A story without a twin cannot leave drafting: the board refuses `spec_done` and `POST /api/stories/:id/backlog` with a 409 `TwinRequiredError`. This is not a bug to work around.
5. Write the specification summary in `.claude/evidence/<REFERENCE>/spec.md`: scope retained, key decisions, out of scope, points to watch. Title the sections `## Scope retained` and `## Key decisions`: the proof is refused if a section is missing or if the file carries no real prose.
6. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"spec_done","evidencePath":".claude/evidence/<REFERENCE>/spec.md"}`.
7. Send the story to the backlog (`POST /api/stories/:id/backlog`) and state that the next step is `/PLAN`.
