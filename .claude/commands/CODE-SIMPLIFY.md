---
description: Clean up the code of the story without changing its behavior
---

Step 5 of the forge-ops sequence. Prerequisite: `build_done` proven (`GET /api/stories/:id/dod`). If it is missing, stop and ask for `/BUILD`.

Green tests are your safety net: they authorize the refactor, they also set its limit. This step carries no checkpoint, it proves nothing new — it protects what is already proven.

1. Reread the diff of the story like a reader who did not write it.
2. Flatten the nesting, rename what is vague, tighten the types, delete dead code and noise comments. No comments in the delivered code.
3. Look for duplication introduced during `/BUILD` and for what already existed elsewhere: reuse before creating.
4. Check the placement: `technical/` never depends on `domain/`. A business module placed in `technical/` moves now, not later.
5. Rerun the whole suite after each simplification. If a test falls, the simplification changed the behavior: revert.
6. If you discover a real correctness defect, do not fix it through a refactor: flag it and handle it as a bug.
7. State that the next step is `/VERIFY`.
