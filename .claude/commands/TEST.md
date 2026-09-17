---
description: Write the tests of the twin story, and watch them fail for the right reason
---

Step 3 of the forge-ops sequence. Prerequisite: `arch_done` proven (`GET /api/stories/:id/dod`). If it is missing, stop and ask for `/PLAN`. Related local skill: `test-driven-development`.

1. Read the twin test story. It states the cases; this is where they become code.
2. Write the tests before any implementation. A test that passes the moment it is written tests nothing.
3. Run them and **read the failure**. An import or typing failure is not a valid red: the expected red is a missing behavior. If the module does not exist yet, lay down its surface with signatures that refuse, then run again.
4. If the tests pass on the first try, check the suite by mutation: deliberately break the rule under test, check that the test falls, then revert.
5. Write in `.claude/evidence/<REFERENCE>/tests.md` the list of cases covered and a pointer to the red run, under the sections `## Cases covered` and `## Run reference`: the reference is the run itself, not its transcript - a CI run url or id, or the exact command between backticks and where its output lives. The proof is refused if a section is missing, if the file carries no real prose, or if the run section points at nothing.
6. Prove the step: `POST /api/stories/:id/checkpoints` with `{"name":"tests_written","evidencePath":".claude/evidence/<REFERENCE>/tests.md"}`.
7. State that the next step is `/BUILD`.
