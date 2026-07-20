---
name: archi
description: Use quand la spec est verrouillée, avant le plan — cartographier ce qui existe déjà et où la feature se branche, pour éviter la duplication.
---

# archi

Étape 3 du pipeline (`WORKFLOW.md`). L'étape qui **évite les doublons** : se mettre d'accord
sur l'architecture cible en regardant le code réel.

## Quand
Après `spec`, avant `/PLAN`. Systématique dès qu'on touche du code partagé ou un domaine existant.

## Étapes
1. Lancer **graphify** sur le(s) worktree(s) concerné(s) → un graphe de ce qui existe.
2. Repérer le **commun réutilisable** (passe de similarité) : helpers, composants, endpoints déjà là.
3. Décider **où la feature se branche** (réutiliser vs créer), noter les points d'extension.
4. Écrire l'archi cible via **`set_arch_node`** (fichier / rôle / statut `planned`).

## Sortie / checkpoint
`arch_done` + nœuds d'archi renseignés (doc vivante).

## Garde-fous
Extraire du commun = **refactor coordonné, décision humaine** — ne pas refactorer en douce
dans une worktree isolée. Si un doublon existe déjà, le signaler, pas le recréer.

## Origine
Interne (graphify) + convergence `mattpocock`/`addyosmani` (archi avant build), réécrit.
