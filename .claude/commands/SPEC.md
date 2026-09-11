---
description: Ecrire la story et sa story de test jumelle, avant la moindre ligne de code
---

Etape 1 de la sequence forge (`/SPEC /PLAN /TEST /BUILD /CODE-SIMPLIFY /VERIFY /REVIEW /SHIP`). Skill locale associee : `spec-clarification`.

L'unite de travail est la **story**, pas la branche ni la tache. Le board te donne dans ton prompt de dispatch la reference et l'identifiant de la story sur laquelle tu travailles. Le board ecoute sur `http://localhost:8830` (`FORGE_PORT`).

1. Clarifie avec l'utilisateur ce qui doit etre construit : perimetre exact, criteres d'acceptation, ce qui est explicitement hors scope. Aucun code a cette etape.
2. Ecris la story : `POST /api/stories` avec `epicId`, `title`, `body`. Le board derive la reference du slug du projet.
3. Ecris sa **story de test jumelle** : `POST /api/stories/:id/twin` avec `title` et `body`. Elle enonce les cas a couvrir, pas leur implementation, et suit les conventions test-casebook.
4. Une story sans jumelle ne peut pas quitter la redaction : le board refuse `spec_done` et `POST /api/stories/:id/backlog` en 409 `TwinRequiredError`. Ce n'est pas un bug a contourner.
5. Ecris le resume de specification dans `.claude/evidence/<REFERENCE>/spec.md` : perimetre retenu, decisions cles, hors scope, points d'attention. Titre les sections `## Perimetre retenu` et `## Decisions cles` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose.
6. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"spec_done","evidencePath":".claude/evidence/<REFERENCE>/spec.md"}`.
7. Envoie la story au backlog (`POST /api/stories/:id/backlog`) et rappelle que l'etape suivante est `/PLAN`.
