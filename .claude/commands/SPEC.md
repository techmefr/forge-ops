---
description: Verrouiller ce qui doit etre construit avant la moindre ligne de code
---

Etape 1 de la sequence starfleet (`/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP`). Sequence pilotee par le dev — chaque etape est un garde-fou humain, pas un pipeline autonome. Skill locale associee : `spec-clarification`.

1. Determine l'identite du projet (remote git `git config --get remote.origin.url`, sinon la racine du repo) et la branche courante (`git branch --show-current`). Appelle l'outil MCP `create_task` avec `project` et `branch` : le port retourne est deterministe et **unique parmi tous les projets suivis** (deux projets ne peuvent plus reserver le meme port, meme avec une branche du meme nom). Applique ce port au serveur lance (`--port`, variable `PORT`, ou entree `launch.json`) — sinon le serveur garde son port code en dur et le conflit revient. Reutilise le meme `project`/`branch` pour tous les appels MCP suivants.
2. Clarifie avec l'utilisateur ce qui doit etre construit : perimetre exact, criteres d'acceptation, ce qui est explicitement hors scope. Ne commence aucun code a cette etape.
3. Une fois la specification actee, appelle l'outil MCP `update_checkpoint` avec `branch`, `checkpoint: "spec_done"` et un `contextSummary` condense (perimetre retenu, decisions cles, points d'attention).
4. Rappelle a l'utilisateur que l'etape suivante est `/PLAN`.
