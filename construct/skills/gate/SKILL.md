---
name: gate
description: Use quand le code est écrit, avant la review — verrou mécanique : interdit de déclarer un critère « passant » sans preuve, et un évaluateur à contexte propre tranche.
---

# gate

Étape 7 du pipeline (`WORKFLOW.md`). **Le renfort n°1 de la veille.** Transforme « tests verts »
d'un vœu déclaratif en un **fait prouvé**. « Done » devient structurel, pas une affirmation.

## Quand
Après `code` (implémentation faite), avant `review`.

## Étapes
1. Pour chaque ligne `{ passes: false }` de `test-results.json`, **produire une preuve** :
   sortie de test, screenshot `verify-flow`, ou log — puis la **lire** (`Read`).
2. Le hook natif `PreToolUse` **refuse** d'écrire `passes: true` tant que la preuve
   correspondante n'a pas été lue. On ne peut pas se déclarer passant sans observer.
3. Lancer l'**évaluateur à contexte propre** : un sous-agent **sans Write/Edit**, qui n'a pas
   vu la construction, examine le diff + les preuves et rend `PASS` ou `NEEDS_WORK` + findings.
4. `NEEDS_WORK` → les findings deviennent le prompt du prochain passage `code`. Reboucler.

## Sortie / checkpoint
`verified` — toutes les lignes `passes: true`, chacune adossée à une preuve lue, évaluateur `PASS`.

## Garde-fous
L'agent ne peut **pas s'auto-valider** : la validation vient du hook (preuve) + de l'évaluateur
(contexte propre). Reste dans le natif Claude Code (hooks + sous-agent), aucune couche maison.

## Origine
`cwc-long-running-agents` (default-FAIL hook + fresh-context evaluator), réécrit à notre sauce.
