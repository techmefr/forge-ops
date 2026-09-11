---
description: Put the story through the quality, security, accessibility cascade
---

Step 7 of the forge-ops sequence. Prerequisite: `verified` proven (`GET /api/stories/:id/dod`). If it is missing, stop and ask for `/VERIFY`. Related local skill: `code-review-discipline`.

The review runs as a **cascade, in this order**: quality, then security, then accessibility. Each pass reads the whole diff of the story, with its own lens, without reusing the conclusions of the previous one.

1. Quality pass (`lens: "quality"`): correctness first, then reuse, simplification, placement. A correctness defect is always `strong`.
2. Security pass (`lens: "security"`): missing authorization, injection surface, exposed secret, payload not validated at a boundary.
3. Accessibility pass (`lens: "accessibility"`): semantics, keyboard, visible focus, contrast, labels of icon controls. With no interface touched, the pass concludes in one line.
4. Record each finding with its severity. `strong` = the story cannot ship as it is. `weak` = worth knowing, does not block.
5. An unresolved `strong` finding **prevents** proving `reviewed`: the board answers 409 `UnresolvedFindingError`. Fix it, then mark the finding resolved — do not lower its severity to get through.
6. Write the synthesis in `.claude/evidence/<REFERENCE>/reviewed.md`: findings per lens, what was fixed, what stays `weak` and why, under a `## Findings` section: the proof is refused if a section is missing or if the file carries no real prose.
7. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"reviewed","evidencePath":".claude/evidence/<REFERENCE>/reviewed.md"}`.
8. State that the next step is `/SHIP`.
