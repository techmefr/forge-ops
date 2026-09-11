---
name: spec-clarification
description: Use before or during /SPEC, or whenever scope, acceptance criteria, or what-is-out-of-scope is unclear before any code is written.
---

# Specification clarification

Before any line of code, the scope must be locked down. Never jump straight to the implementation because the request "looks simple".

## Method

1. Restate what you understand you must build, in one sentence.
2. Identify what is ambiguous: data formats, edge cases, expected behavior on error, what must stay out of scope.
3. Ask targeted questions instead of guessing. A short question now costs less than a `/BUILD` redone from scratch.
4. Explicitly separate what is asked from what could be added "while we are at it" — that last part is out of scope unless explicitly requested.
5. Once the scope is clear, summarize it: what will be built, acceptance criteria, what is excluded.

## Link with the forge-ops sequence

That summary becomes `.claude/evidence/<REFERENCE>/spec.md`, the proof of the `spec_done` checkpoint. The `/PLAN` that follows must stay strictly inside that scope — any drift noticed at `/PLAN` must send you back to this step rather than be absorbed silently.

The scope is described on two objects, not one: the functional story and its twin test story. As long as the twin is not written, the board refuses `spec_done`.
