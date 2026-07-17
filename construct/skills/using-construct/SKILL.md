---
name: using-construct
description: Use when starting any task in a Xefi project — établit le pipeline construct (tâche → brainstorm → spec → archi → plan → TDD → code → review → MR → merge → finish) et comment les skills se branchent sur starfleet.
---

# using-construct

Point d'entrée de la couche méthode Xefi. À lire au début de toute tâche.

## La règle

**Avant toute action** (y compris une question de clarification ou l'exploration du repo),
identifie la skill construct qui s'applique et invoque-la. Annonce « J'utilise [skill]
pour [but] » puis suis-la. Si une checklist existe, une todo par item.

## Le pipeline (ordre)

Chaque étape écrit son checkpoint dans starfleet (`update_checkpoint`) :

1. **start-feature** — crée la worktree isolée (starfleet `create_task` + `launch_worktree`).
2. **brainstorm** — explorer l'intention avant tout code.
3. **spec** — verrouiller périmètre + hors-scope (conventions Xefi).
4. **archi** — se mettre d'accord sur l'architecture cible, puis l'écrire (`set_arch_node`).
5. **plan** — découper en tâches atomiques.
6. **tdd** — tests d'abord (doctrine **test-casebook**).
7. **code** — construire par incréments.
8. **review** — auto-review + agents (bobby / valerianus).
9. **MR + analyses** — gandalf (/code-review, /security-review) + MR draft, **2 approbations humaines**.
10. **finish** — post-merge : `finish_task` (arrête le serveur, retire la worktree, met à jour develop).

## Le seam avec starfleet

Une skill construct **ne réinvente pas l'orchestration** : elle appelle les tools MCP de
starfleet (create_task, launch_worktree, update_checkpoint, set_arch_node, escalate,
finish_task) et laisse le dashboard refléter l'état. Méthode ≠ état : construct décide
*quoi/comment*, starfleet tient *où/état*.

## Garde-fous

- Les **2 approbations humaines** et le **merge** sont hors du périmètre agent — on s'arrête
  à la MR draft et on rend la main.
- Bloqué et ça se répète ? `escalate` plutôt que boucler.
- « Je sais déjà faire » ≠ « j'ai suivi la skill ». Invoque-la.
