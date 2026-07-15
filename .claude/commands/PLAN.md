---
description: Decouper la specification en taches atomiques, sans derive de scope
---

Etape 2 de la sequence starfleet. Prerequis : `checkpoint: spec_done` present pour la branche courante (verifie via `get_worktree_status`). Si absent, arrete-toi et demande d'abord `/SPEC`.

1. Relis le `contextSummary` existant de la tache pour rester coherent avec la specification actee.
2. Decoupe la specification en taches atomiques et ordonnees. Pas de fonctionnalite non demandee, pas de derive de perimetre par rapport a `/SPEC`.
3. Une fois le plan valide par l'utilisateur, appelle `update_checkpoint` avec `checkpoint: "plan_done"` et un `contextSummary` listant les taches atomiques retenues et leur ordre.
4. Rappelle que l'etape suivante est `/TEST`.
