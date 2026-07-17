---
name: start-feature
description: Use au tout début d'une feature, avant de coder — crée la worktree isolée via starfleet (create_task + launch_worktree) et amorce le pipeline. Réécriture Xefi de superpowers:using-git-worktrees, branchée sur starfleet.
---

# start-feature

Démarre une feature dans un espace **isolé** (worktree dédiée), coordonné par starfleet
(port déterministe unique, état partagé, visibilité dashboard).

## Étapes

1. **Identité** : déduis le projet (remote git `git config --get remote.origin.url`, sinon
   racine du repo) et la branche cible.
2. **Enregistrer + allouer** : appelle le tool MCP starfleet **`create_task`** avec
   `project`, `branch`, `repoPath`, `runCommand` (commande de dev), et `feature`/`role`
   (front/back) si pertinent. Tu récupères un **port unique** (aucune collision avec les
   autres projets/worktrees).
3. **Créer la worktree** : appelle **`launch_worktree`** — starfleet fait le
   `git worktree add` dans un dossier voisin, isolé de ton workspace courant.
   (Vérifie d'abord que le dossier des worktrees est bien gitignore.)
4. **(option) Démarrer le serveur** : `start_server` — lance `runCommand` avec le port injecté ;
   le dashboard passe la worktree en « live » et donne le lien « Ouvrir ».
5. **Enchaîner** : passe à `brainstorm` puis `spec`. À chaque étape franchie,
   `update_checkpoint`.

## Pourquoi passer par starfleet

L'isolation par worktree seule (comme superpowers:using-git-worktrees) empêche les
interférences, mais **ne coordonne pas** les ports ni la visibilité multi-projets. Le seam
avec starfleet ajoute : port déterministe anti-collision, source de vérité partagée,
dashboard, et le nettoyage post-merge (`finish_task`).

## Fin de vie

Ne supprime pas la worktree à la main : c'est `finish` (→ `finish_task`) qui l'enlève
proprement après merge et met à jour develop.
