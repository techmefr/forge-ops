---
name: tdd
description: Use lors de l'étape tests, avant le code — écrire les tests d'abord (doctrine test-casebook) et transformer chaque critère d'acceptation en une ligne de contrat qui échoue par défaut.
---

# tdd

Étape 5 du pipeline (`WORKFLOW.md`). Les tests d'abord, et un **contrat par défaut à ÉCHEC**
qui rendra le GATE (étape 7) mécanique.

## Quand
Après `plan`, avant d'écrire l'implémentation.

## Étapes
1. Pour **chaque critère d'acceptation** de la spec, créer une ligne dans `test-results.json`
   initialisée à `{ "passes": false }` (le contrat démarre à l'échec).
2. Écrire le test correspondant selon **test-casebook** (sélecteurs `data-test-*`, exhaustif,
   persona matrix, couverture cible ≥ 90 %).
3. Lancer la suite : **tout est rouge** — c'est le résultat attendu à cette étape.

## Sortie / checkpoint
`tests_written` + `test-results.json` (toutes lignes `{ passes: false }`).

## Garde-fous
Aucun test contourné, masqué ou désactivé. Le contrat par défaut est **échec** : rien n'est
« passant » tant que le GATE ne l'a pas prouvé.

## Origine
Xefi `test-casebook` + `cwc-long-running-agents` (default-FAIL contract), réécrit.
