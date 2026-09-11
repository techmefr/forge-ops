---
description: Build in increments up to green, never everything at once
---

Step 4 of the forge-ops sequence. Prerequisite: `tests_written` proven (`GET /api/stories/:id/dod`). If it is missing, stop and ask for `/TEST`. Related local skills: `test-driven-development`, `systematic-debugging`.

1. Build in atomic increments, one element of the plan at a time, staying inside the paths announced at `/PLAN`.
2. Write the minimum code that makes the current test pass. No anticipation of features nobody asked for.
3. The deny guardrail (`.claude-deny.json`, applied by the `PreToolUse` hook) refuses destructive commands before execution. It fails closed: if its list becomes unreadable, it blocks instead of letting things through. A refused command is not worked around, it is rephrased.
4. The board receives the files you edit through the `PostToolUse` hook and attributes them to the story. You have nothing to declare.
5. If the same failure repeats identically, do not run in a loop: diagnose the cause with `systematic-debugging`. Two identical failures in a row are a stop signal, escalate to the human instead of insisting.
6. Finish with the whole suite green and the typing clean, not only the tests of the file you touched.
7. Write in `.claude/evidence/<REFERENCE>/build.md` what was built and the output of the green run, under the sections `## What was built` and `## Run output`: the proof is refused if a section is missing or if the file carries no real prose.
8. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"build_done","evidencePath":".claude/evidence/<REFERENCE>/build.md"}`.
9. State that the next step is `/CODE-SIMPLIFY`.
