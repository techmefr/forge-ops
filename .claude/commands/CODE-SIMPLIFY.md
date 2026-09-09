---
description: Nettoyer le code de la story sans changer son comportement
---

Etape 5 de la sequence forge. Prerequis : `build_done` prouve (`GET /api/stories/:id/dod`). Si absent, arrete-toi et demande `/BUILD`.

Les tests verts sont ton filet : ils autorisent le refactor, ils en fixent aussi la limite. Cette etape ne porte aucun checkpoint, elle ne prouve rien de nouveau — elle protege ce qui est deja prouve.

1. Relis le diff de la story comme un lecteur qui ne l'a pas ecrit.
2. Aplatis l'imbrication, renomme ce qui est vague, resserre les types, supprime le code mort et les commentaires de bruit. Pas de commentaires dans le code livre.
3. Cherche la duplication introduite pendant `/BUILD` et ce qui existait deja ailleurs : reutiliser avant de creer.
4. Verifie le placement : `technical/` ne depend jamais de `domain/`. Un module metier place dans `technical/` se deplace maintenant, pas apres.
5. Relance la suite entiere apres chaque simplification. Si un test tombe, la simplification a change le comportement : reviens en arriere.
6. Si tu decouvres un vrai defaut de correction, ne le corrige pas par un refactor : signale-le et traite-le comme un bug.
7. Rappelle que l'etape suivante est `/VERIFY`.
