---
name: verification-before-shipping
description: Use during /VERIFY and before /SHIP, or whenever about to claim work is complete, fixed, or passing — before committing or opening a merge request.
---

# Verification before shipping

Never claim "it works" or "the tests pass" without having actually run the command and read its output. A claim without proof is the starting point of silent regressions.

## What is required before claiming

1. The complete test suite was run in this session, not merely assumed green because it was green before the last changes.
2. The output of the command was read in full — an unchecked exit code is not a proof.
3. If a test was modified or deleted to make the suite pass, that is flagged explicitly, not passed over in silence.

## A green suite does not prove the story

Green proves that the code does what the test says. It does not prove that the story works. That is why `/VERIFY` exists between `/BUILD` and `/REVIEW`: walking the path described by the story for real, in the driven browser when it is visible, through a real round trip on the API when it is not. The refusal cases are walked as much as the nominal case.

## Golden rule of forge-ops

**A step is proven by a file, never by a claim.** Every checkpoint demands a non-empty `evidencePath`, and the board refuses a step out of sequence. If you could not run what you were supposed to observe, say so and stop — do not prove a step you did not cross.

## Link with the forge-ops sequence

`/VERIFY` writes `.claude/evidence/<REFERENCE>/verified.md`: what was walked through, what was observed, the captures or the raw responses pasted in. `/SHIP` then rereads the full definition of done through `GET /api/stories/:id/dod`: if a single one of the six steps is at `proven: false`, there is no shipping. The last gate stays human — the story waits in `shipping`, it does not move to `done` on its own.
