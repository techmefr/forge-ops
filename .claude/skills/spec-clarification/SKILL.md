---
name: spec-clarification
description: Use before or during /SPEC, or whenever scope, acceptance criteria, or what-is-out-of-scope is unclear before any code is written.
---

# Clarification de specification

Avant toute ligne de code, le perimetre doit etre verrouille. Ne jamais sauter directement a l'implementation parce que la demande "semble simple".

## Demarche

1. Reformule ce que tu comprends devoir construire, en une phrase.
2. Identifie ce qui est ambigu : formats de donnees, cas limites, comportement attendu en cas d'erreur, ce qui doit rester hors scope.
3. Pose des questions ciblees plutot que de deviner. Une question courte maintenant coute moins cher qu'un `/BUILD` refait a zero.
4. Distingue explicitement ce qui est demande de ce qui pourrait etre ajoute "tant qu'on y est" — ce dernier point est hors scope sauf demande explicite.
5. Une fois le perimetre clair, resume-le : ce qui sera construit, criteres d'acceptation, ce qui est exclu.

## Lien avec la sequence starfleet

Ce resume devient le `contextSummary` ecrit via l'outil MCP `update_checkpoint` (`checkpoint: "spec_done"`). Le `/PLAN` qui suit doit rester strictement dans ce perimetre — toute derive constatee a `/PLAN` doit renvoyer a cette etape plutot que d'etre absorbee silencieusement.
