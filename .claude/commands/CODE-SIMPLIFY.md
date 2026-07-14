---
description: Refactorer le code malin en code clair
---

Etape 6 de la sequence starfleet. Prerequis : `checkpoint: reviewed`. Si absent, arrete-toi et demande `/REVIEW`.

1. Appelle `recommend_model` avec `step: "CODE-SIMPLIFY"` pour la branche courante et rapporte la recommandation (etape d'architecture/decisions structurantes).
2. Simplifie le code construit a l'etape `/BUILD` : elimine les abstractions inutiles, les commentaires qui ne font que decrire le quoi, les branches mortes. Garde le comportement identique, valide par les tests deja verts.
3. Relance la suite de tests complete apres chaque simplification pour t'assurer qu'aucune regression n'a ete introduite.
4. Appelle `update_checkpoint` avec `checkpoint: "simplified"` et un `contextSummary` decrivant ce qui a ete simplifie.
5. Rappelle que l'etape suivante est `/SHIP`.
