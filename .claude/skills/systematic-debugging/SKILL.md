---
name: systematic-debugging
description: Use whenever encountering a bug, unexpected test failure, or repeated error during /BUILD, before proposing a fix.
---

# Systematic debugging

Never propose a fix before having understood the real cause. A fix that silences the symptom without understanding the cause comes back sooner or later, often worse.

## Method

1. Reproduce the error reliably before touching the code.
2. Read the whole error message, the full stack trace, not just the first line.
3. State an explicit hypothesis about the cause before modifying anything.
4. Check the hypothesis through an observation (log, isolated test, print), not through intuition.
5. Fix the cause you identified, not the nearest symptom.
6. Rerun the complete test suite, not only the test that was failing.

## Loop detection

If the same error comes back identically after an attempted fix, that is the sign that the starting hypothesis was false — change angle rather than retrying the same fix.

## Link with the forge-ops sequence

Nobody counts your attempts for you: stopping is on you. Two identical failures in a row, or a third hypothesis that falls, and you escalate to the human rather than continue — the story stays where it is, no checkpoint is proven.

What you understood of the cause goes in the proof file of the current step (`.claude/evidence/<REFERENCE>/build.md` during `/BUILD`), with the raw output that establishes it. A documented blocker is reusable; an erased blocker is paid for twice.
