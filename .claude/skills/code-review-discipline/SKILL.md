---
name: code-review-discipline
description: Use during /REVIEW, when reading the full diff of a story through the quality, security and accessibility lenses, and when addressing review comments received afterwards.
---

# Review discipline

An agent's review does not replace the final human validation. It exists to reach that validation with as little noise as possible, and above all with no correctness defect left.

## Three lenses, in this order

The review is read as a cascade: quality, then security, then accessibility. Each pass rereads the whole diff with its own lens, without reusing the conclusions of the previous one — a pass that merely says "already covered above" did not happen.

1. **Quality**: correctness first. The diff builds exactly what the story settled, no more, no less. Then reuse of what already exists, simplification, placement in the right layer (`technical/` never imports `domain/`). No magic value, no dead code, no comment.
2. **Security**: missing authorization, injection surface, exposed secret, payload not validated at a boundary.
3. **Accessibility**: semantics, keyboard navigation, visible focus, contrast, labels of icon controls. With no interface touched, the pass concludes in one line — not in silence.

## Severity

A finding is `strong` or `weak`, and that choice is not negotiable afterwards.

- `strong`: the story cannot ship as it is. Any correctness defect is `strong`.
- `weak`: worth knowing, does not block.

Never lower a severity to unblock a story. The board refuses to prove `reviewed` as long as a `strong` finding is unresolved, and that is the intended behavior.

## Tests

A green suite obtained by disabling, weakening or deleting a test is not a green suite. If a test moved during `/BUILD`, the review looks at it first.

## Receiving a human review

A review comment deserves a technical check before being applied, not an automatic agreement. If the comment looks incorrect or rests on a false assumption, say so explicitly rather than applying a change you do not understand.

## Link with the forge-ops sequence

`/REVIEW` comes after `/VERIFY` and before `/SHIP`. The synthesis of the three passes is written in `.claude/evidence/<REFERENCE>/reviewed.md`: findings per lens, what was fixed, what stays `weak` and why. That file is what the human reads at the last gate.
