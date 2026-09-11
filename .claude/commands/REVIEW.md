---
description: Passer la story en cascade qualite, securite, accessibilite
---

Etape 7 de la sequence forge. Prerequis : `verified` prouve (`GET /api/stories/:id/dod`). Si absent, arrete-toi et demande `/VERIFY`. Skill locale associee : `code-review-discipline`.

La review se fait en **cascade, dans cet ordre** : qualite, puis securite, puis accessibilite. Chaque passe lit le diff entier de la story, avec sa propre lentille, sans reprendre les conclusions de la precedente.

1. Passe qualite (`lens: "quality"`) : correction d'abord, puis reutilisation, simplification, placement. Un defaut de correction est toujours `strong`.
2. Passe securite (`lens: "security"`) : autorisation manquante, surface d'injection, secret expose, charge utile non validee a une frontiere.
3. Passe accessibilite (`lens: "accessibility"`) : semantique, clavier, focus visible, contraste, libelles des controles icone. Sans interface touchee, la passe se conclut en une ligne.
4. Enregistre chaque finding avec sa severite. `strong` = la story ne peut pas partir en l'etat. `weak` = a savoir, ne bloque pas.
5. Un finding `strong` non resolu **empeche** de prouver `reviewed` : le board repond 409 `UnresolvedFindingError`. Corrige, puis marque le finding resolu — ne baisse pas sa severite pour passer.
6. Ecris la synthese dans `.claude/evidence/<REFERENCE>/reviewed.md` : findings par lentille, ce qui a ete corrige, ce qui reste en `weak` et pourquoi, sous une section `## Findings` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose.
7. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"reviewed","evidencePath":".claude/evidence/<REFERENCE>/reviewed.md"}`.
8. Rappelle que l'etape suivante est `/SHIP`.
