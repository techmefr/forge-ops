---
name: code
description: Use lors de la construction — implémenter par incréments jusqu'à faire passer les tests, un task_item à la fois.
---

# code

Étape 6 du pipeline (`WORKFLOW.md`). Construire le minimum qui fait passer chaque test.

## Quand
Après `tdd` (tests rouges écrits), pendant `/BUILD`.

## Étapes
1. Prendre **un** `task_item`, écrire le minimum de code pour faire passer son test.
2. `toggle_task_item` quand l'incrément est fait, commit.
3. Bloqué / erreur inattendue → invoquer la brique **`debug`** avant de proposer un fix.
4. Répéter jusqu'à épuisement des `task_items`.

## Sortie / checkpoint
`build_done`.

## Garde-fous
**Pas de commentaires dans le code.** Ne **jamais** marquer un test `passes: true` à la main —
c'est le **GATE** (étape 7) qui tranche, sur preuve. On ne s'auto-valide pas.

## Origine
Natif Claude Code + interne, réécrit.
