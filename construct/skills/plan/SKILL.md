---
name: plan
description: Use quand l'archi est posée, avant d'écrire des tests ou du code — découper la feature en tâches atomiques testables.
---

# plan

Étape 4 du pipeline (`WORKFLOW.md`). Transformer l'archi cible en incréments livrables.

## Quand
Après `archi`, avant `tdd`.

## Étapes
1. Découper en incréments **atomiques** : chacun testable et livrable indépendamment.
2. Ordonner par dépendance (ce qui débloque le reste d'abord).
3. Créer un `add_task_item` par incrément (suivi dans starfleet + dashboard).

## Sortie / checkpoint
`plan_done` + `task_items` renseignés.

## Garde-fous
Pas d'exécution automatique de tout le plan (**pas de `/build auto`** — cf. `WORKFLOW.md`,
l'auto-mode a été retiré volontairement). Le dev valide et avance étape par étape.

## Origine
Natif / `addyosmani` (planning-and-task-breakdown), réécrit à notre sauce.
