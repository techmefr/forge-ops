---
name: spec
description: Use quand on verrouille le périmètre d'une feature avant le plan — interview de clarification, périmètre + hors-scope explicites, CONTEXT.md et ADR.
---

# spec

Étape 2 du pipeline (`WORKFLOW.md`). Verrouiller *quoi* on construit, avec un vocabulaire
partagé et des décisions tracées.

## Quand
Après `brainstorm`, avant `/PLAN`. Ou dès que le périmètre / les critères d'acceptation sont flous.

## Étapes
1. **Interviewer** le dev : une question ciblée par ambiguïté, jusqu'à ce que le périmètre soit net.
2. Écrire **`CONTEXT.md`** : le vocabulaire partagé de la feature (termes, entités, règles métier).
3. Lister les **critères d'acceptation** explicites (ils deviendront le contrat de `tdd`).
4. Lister le **hors-scope** explicite.
5. Écrire un **ADR** pour chaque décision structurante (choix + alternatives écartées + pourquoi).

## Sortie / checkpoint
`spec_done` + `CONTEXT.md` + ADR(s).

## Garde-fous
Aucun code. Si le périmètre reste flou après l'interview, `escalate` plutôt que deviner.

## Origine
`mattpocock/skills` (grill-with-docs → CONTEXT.md + ADR) + interne `spec-clarification`, réécrit.
