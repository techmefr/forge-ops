---
description: Ship the story behind a human validation
---

Step 8 of the forge-ops sequence. Prerequisite: the six checkpoints proven. Check with `GET /api/stories/:id/dod`: if a single step is at `proven: false`, stop and resume at that one.

No agent closes a story on its own. The last gate is human.

1. Reread the full definition of done and show it to the user: the six steps, their proof, the path of each proof.
2. Commit on the branch dedicated to the story. Message in English, conventional commit, description in lowercase. No trace of AI in the code nor in the messages.
3. Push and open the merge request toward the integration branch of the project.
4. Ask for the human validation. As long as it is not given, the story stays in `shipping`, not in `done`.
5. On a merge conflict, force nothing: the board flags it on the kanban card, and the resolution is delegated explicitly.
6. Once the validation is obtained, move the story to `done`. Its test twin follows the same fate.
