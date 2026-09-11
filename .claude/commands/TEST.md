---
description: Ecrire les tests de la story jumelle, et les voir echouer pour la bonne raison
---

Etape 3 de la sequence forge. Prerequis : `arch_done` prouve (`GET /api/stories/:id/dod`). Si absent, arrete-toi et demande `/PLAN`. Skill locale associee : `test-driven-development`.

1. Lis la story de test jumelle. Elle enonce les cas ; c'est ici qu'ils deviennent du code.
2. Ecris les tests avant toute implementation. Un test qui passe des sa premiere ecriture ne teste rien.
3. Lance-les et **lis l'echec**. Un echec d'import ou de typage n'est pas un rouge valide : le rouge attendu est un comportement absent. Si le module n'existe pas encore, pose sa surface avec des signatures qui refusent, puis relance.
4. Si les tests passent du premier coup, verifie la suite par mutation : casse volontairement la regle testee, verifie que le test tombe, puis reviens en arriere.
5. Ecris dans `.claude/evidence/<REFERENCE>/tests.md` la liste des cas couverts et la sortie du run rouge, sous les sections `## Cas couverts` et `## Sortie du run` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose.
6. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"tests_written","evidencePath":".claude/evidence/<REFERENCE>/tests.md"}`.
7. Rappelle que l'etape suivante est `/BUILD`.
