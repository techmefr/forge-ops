---
name: simplify
description: Use après la review, avant le SHIP — passe qualité sur le code changé (réutilisation, simplification, efficacité), sans chasse aux bugs.
---

# simplify

Étape 9 du pipeline (`WORKFLOW.md`). Nettoyer ce qui a été construit, une fois qu'il est correct.

## Quand
Après `review` (`reviewed`), avant `ship`.

## Étapes
1. Relire le diff : réutilisation manquée, code dupliqué, indirection inutile, sur-abstraction.
2. Simplifier à iso-comportement (les tests du GATE restent verts).
3. Vérifier la cohérence avec l'archi (`set_arch_node` : marquer les nœuds `done`).

## Sortie / checkpoint
`simplified`.

## Garde-fous
Qualité uniquement — **pas** de chasse aux bugs ici (c'était `review`/`gate`). Ne pas changer
le comportement ; si une simplification casse un test, c'est un vrai changement → retour `code`.

## Origine
Natif Claude Code (skill `simplify`) + interne, réécrit.
