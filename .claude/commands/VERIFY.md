---
description: See the story work for real, not only in tests
---

Step 6 of the forge-ops sequence. Prerequisite: `build_done` proven (`GET /api/stories/:id/dod`). If it is missing, stop and ask for `/BUILD`. Related local skill: `verification-before-shipping`.

A green suite proves that the code does what the test says. It does not prove that the story works. This step produces that proof.

1. Run the application and walk the path described by the story, in the driven browser when the story is visible, through a real round trip on the API when it is not.
2. Go through the refusal cases as much as the nominal case: what the story forbids must be refused, with the right code and the right message.
3. Look at the console and the network requests, not only at the rendering. A correct page screaming in the console is not verified.
4. If the story touches an interface: check the keyboard, the visible focus, the contrast of normal text, and the rendering in dark theme as well as light.
5. Capture the proof in `.claude/evidence/<REFERENCE>/verified.md`: what was walked through, what was observed, the captures or the raw responses. Title the sections `## What was walked through` and `## What was observed`: the proof is refused if a section is missing or if the file carries no real prose. A claim without pasted output is not a proof.
6. Never declare verified what you did not execute. If you could not run the application, say so and stop here.
7. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"verified","evidencePath":".claude/evidence/<REFERENCE>/verified.md"}`.
8. State that the next step is `/REVIEW`.
