---
name: finish
description: Use après le merge humain de la MR — nettoie la worktree et met à jour la branche d'intégration. Ferme la boucle du pipeline.
---

# finish

Étape 11 du pipeline (`WORKFLOW.md`). Post-merge : ranger derrière soi.

## Quand
Une fois la MR **mergée par un humain** (jamais avant).

## Étapes
1. Appeler `finish_task(project, branch, base?)` : arrête le serveur, retire la worktree git
   (`git worktree remove`), met à jour la branche d'intégration (`develop` par défaut, fast-forward),
   supprime la ligne en base.
2. Vérifier que le dashboard ne liste plus la worktree.

## Sortie / checkpoint
Ligne supprimée — la tâche sort du suivi.

## Garde-fous
Ne pas supprimer la worktree à la main : c'est `finish_task` qui le fait proprement. Ne rien
lancer avant le merge humain. La base d'intégration est **configurable** (`base`), pas `develop`
en dur si le repo utilise `main`.

## Origine
Interne starfleet (`finish_task`), réécrit à notre sauce.
