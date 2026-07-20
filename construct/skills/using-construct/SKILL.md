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

Chaque étape écrit son checkpoint dans starfleet (`update_checkpoint`). Toutes les briques
suivent le **gabarit unique** (`construct/CONVENTIONS.md`) et sont réécrites à notre sauce :

1. **start-feature** — crée la worktree isolée (starfleet `create_task` + `launch_worktree`).
2. **brainstorm** — explorer l'intention avant tout code.
3. **spec** — verrouiller périmètre + hors-scope ; `CONTEXT.md` + ADR → `spec_done`.
4. **archi** — archi cible via graphify (anti-duplication), écrite (`set_arch_node`) → `arch_done`.
5. **plan** — découper en tâches atomiques → `plan_done`.
6. **tdd** — tests d'abord (**test-casebook**) + contrat `{passes:false}` → `tests_written`.
7. **code** — construire par incréments (`debug` en support) → `build_done`.
8. **gate** — verrou mécanique : preuve obligatoire + évaluateur à contexte propre → `verified`.
9. **review** — 2 axes parallèles (Standards + Spec) + agents Xefi + `/code-review`/`/security-review`.
10. **simplify** — passe qualité à iso-comportement → `simplified`.
11. **ship** — push + MR **draft** (dev + 2 collègues) → `mr_draft_pushed`, `awaiting_human`. **L'agent s'arrête.**
12. **finish** — post-merge humain : `finish_task` (serveur, worktree, base d'intégration).

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
