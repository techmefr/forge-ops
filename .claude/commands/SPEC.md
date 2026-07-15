---
description: Verrouiller ce qui doit etre construit avant la moindre ligne de code
---

Etape 1 de la sequence starfleet (`/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP`). Sequence pilotee par le dev — chaque etape est un garde-fou humain, pas un pipeline autonome. Skill locale associee : `spec-clarification`.

1. Determine la branche courante (`git branch --show-current`). Si aucune tache n'existe encore pour cette branche dans starfleet, appelle l'outil MCP `create_task` avec ce nom de branche pour obtenir un port alloue de maniere deterministe.
2. Clarifie avec l'utilisateur ce qui doit etre construit : perimetre exact, criteres d'acceptation, ce qui est explicitement hors scope. Ne commence aucun code a cette etape.
3. Une fois la specification actee, appelle l'outil MCP `update_checkpoint` avec `branch`, `checkpoint: "spec_done"` et un `contextSummary` condense (perimetre retenu, decisions cles, points d'attention).
4. Rappelle a l'utilisateur que l'etape suivante est `/PLAN`.
