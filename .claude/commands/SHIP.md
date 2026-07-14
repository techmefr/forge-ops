---
description: Push et ouverture de MR en draft, avec reviewers assignes
---

Etape 7 et derniere de la sequence starfleet. Prerequis : `checkpoint: simplified`. Si absent, arrete-toi et demande `/CODE-SIMPLIFY`. Skill locale associee : `verification-before-shipping`.

**Regle d'or non negociable : aucun passage a `/SHIP` sans tests verts, peu importe qui a ecrit le code.** Fais tourner la suite de tests complete avant toute autre action. Si un test est rouge, arrete-toi ici et retourne a `/BUILD`.

1. Appelle `recommend_model` avec `step: "SHIP"` pour la branche courante et rapporte la recommandation.
2. Verifie qu'aucune commande a executer ne matche `.claude-deny.json` (jamais de `git push --force`).
3. Push la branche, ouvre une MR en **draft** avec reviewers assignes (dev auteur + 2 collegues), template et labels conformes aux conventions du repo.
4. Appelle `update_checkpoint` avec `checkpoint: "mr_draft_pushed"` et un `contextSummary` recapitulant ce qui est livre. Ce checkpoint bascule automatiquement le statut de la tache en `awaiting_human`.
5. A partir d'ici, la revue humaine (MR) prend le relais. Le pipeline agent s'arrete.
