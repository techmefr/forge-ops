---
name: ship
description: Use quand tout est vert et simplifié — push de la branche et ouverture de la MR en draft ; l'agent s'arrête ici.
---

# ship

Étape 10 du pipeline (`WORKFLOW.md`). La **frontière agent/humain** : on prépare, l'humain décide.

## Quand
Après `simplify` (`simplified`), tests du GATE verts.

## Étapes
1. Vérifier une dernière fois : GATE `verified`, suite verte, checkpoints à jour.
2. Push de la branche.
3. Ouvrir la **MR en draft** (dev auteur + 2 collègues), description claire (statut + message).
4. Marquer `mr_draft_pushed` / `status: awaiting_human`.

## Sortie / checkpoint
`mr_draft_pushed`, `status: awaiting_human`.

## Garde-fous
**L'agent s'arrête ici.** Les 2 approbations humaines et le merge sont hors périmètre agent.
Ne jamais merger automatiquement. Commit/MR : conventional commits, description en minuscule.

## Origine
Interne (séquence `/SHIP`, gate final `gandalf`), réécrit à notre sauce.
