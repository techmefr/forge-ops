---
name: merge-worktree
description: Use quand il faut ramener une partie seulement d'un worktree dans la branche courante — merge sélectif (fichier, patch, cherry-pick, merge en revue, multi-worktree) plutôt qu'un merge complet, suivi du nettoyage post-merge. Complète `finish` pour les cas où le retour n'est pas un simple fast-forward.
---

# merge-worktree

Ramène le travail d'une ou plusieurs worktrees dans la branche courante quand un merge complet
ne convient pas (on ne veut qu'une partie du contenu, ou on veut revoir avant de valider).
Se situe à l'étape 11 (`finish`) de `WORKFLOW.md`, en amont de `finish_task` : ici on choisit
*quoi* ramener, `finish` range ensuite la worktree devenue inutile.

## Quand

- Une seule feature, un seul fichier à récupérer d'une worktree.
- Une worktree contient plusieurs changements et seuls certains sont mûrs.
- Il faut revoir le contenu avant de valider le merge (pas de commit automatique).
- Plusieurs worktrees doivent converger dans une seule branche d'intégration.

## Étapes

1. **Repérer les worktrees actives** : `git worktree list` — vérifier chemin et branche de
   chacune avant toute action.
2. **Choisir la stratégie selon le besoin** :
   - **Fichier(s) ciblé(s)** — on sait exactement quoi récupérer, tout le reste est ignoré :
     `git checkout <branche-worktree> -- chemin/fichier`
   - **Patch interactif** — on veut choisir hunk par hunk dans un fichier :
     `git checkout -p <branche-worktree> -- chemin/fichier`
   - **Cherry-pick sans commit** — un commit précis de la worktree, mais on veut retirer
     certains fichiers du commit avant de valider :
     `git cherry-pick --no-commit <sha>` puis `git restore --staged chemin/fichier-à-exclure`
   - **Merge en revue** — tout le contenu de la branche, mais un dernier coup d'œil avant
     de committer :
     `git merge --no-commit --no-ff <branche-worktree>` puis relecture du diff staged
     (`git diff --staged`) avant `git commit`.
   - **Multi-worktree** — plusieurs branches doivent converger dans une seule branche
     d'intégration : répéter le merge en revue par branche, une à une, en résolvant les
     conflits avant de passer à la suivante.
3. **Valider** : committer une fois le contenu vérifié (jamais de commit automatique sur
   cherry-pick/merge tant que le diff staged n'a pas été relu).
4. **Nettoyer** : lister les worktrees restantes (`git worktree list`), retirer celle(s)
   devenue(s) inutiles (`git worktree remove <chemin>`), puis `git worktree prune` si des
   entrées orphelines subsistent (worktree supprimée à la main, disque externe débranché…).

## Sortie / checkpoint

Contenu ciblé mergé dans la branche courante, worktree(s) source retirée(s) proprement.
Si l'étape s'enchaîne avec `finish`, `finish_task` prend le relais pour la worktree
principale de la tâche et met à jour la base d'intégration.

## Garde-fous

- Jamais de `git merge`/`cherry-pick` sans `--no-commit` quand un doute existe sur le contenu :
  toujours relire le diff staged avant de valider.
- Ne pas confondre avec `finish` : `finish` clôt une tâche entière après MR mergée par un
  humain ; `merge-worktree` sert *pendant* le développement, pour du merge sélectif ou
  multi-source.
- Conflit de merge : résoudre fichier par fichier, ne jamais `git checkout --theirs`/`--ours`
  en masse sans relire — ça écrase silencieusement l'autre côté.
- Fichiers modifiés localement en plus de la worktree : stash ou commit avant de merger,
  sinon le merge peut échouer ou mélanger des changements non voulus.
- Worktree stale (chemin disparu, branche supprimée côté remote) : `git worktree prune` avant
  de reprendre la main dessus, ne pas forcer un `remove` sur une entrée déjà cassée sans
  vérifier `git worktree list` d'abord.

## Origine

Idée reprise de : neolabhq/context-engineering-kit — plugins/git/skills/git-worktrees/SKILL.md,
section « How to Merge Worktree ». Mécanisme réécrit à notre sauce (gabarit construct,
articulation avec `finish`/`finish_task`).
