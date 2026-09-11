---
description: Settle the architecture of the story, without drifting from the scope
---

Step 2 of the forge-ops sequence. Prerequisite: `spec_done` proven. Check with `GET /api/stories/:id/dod`; if the step is not proven, stop and ask for `/SPEC`.

1. Read `.claude/evidence/<REFERENCE>/spec.md`. The plan stays strictly inside that scope: any drift you notice sends you back to `/SPEC`, it is never absorbed silently.
2. Propose the architecture: where the files live (`technical/` or `domain/`), which objects, which boundaries. `technical/` never depends on `domain/`.
3. Name the paths the story is going to modify. Check `GET /api/files/conflicts`: if another story already edits one of those paths, flag it before going further instead of discovering the conflict at merge time.
4. Have the plan validated by the user. Without explicit validation, you do not move to the next step.
5. Write the plan you settled on in `.claude/evidence/<REFERENCE>/arch.md`: breakdown, order, paths touched, risks. Title the sections `## Breakdown` and `## Risks`: the proof is refused if a section is missing or if the file carries no real prose.
6. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"arch_done","evidencePath":".claude/evidence/<REFERENCE>/arch.md"}`.
7. State that the next step is `/TEST`.
