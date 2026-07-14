---
description: Auto-review legere de l agent, ne remplace pas la revue humaine en MR
---

Etape 5 de la sequence starfleet. Prerequis : `checkpoint: build_done`. Si absent, arrete-toi et demande `/BUILD`. Skill locale associee : `code-review-discipline`.

1. Appelle `recommend_model` avec `step: "REVIEW"` pour la branche courante et rapporte la recommandation.
2. Relis le diff complet de la branche par rapport a sa base. Verifie coherence avec la specification (`/SPEC`) et le plan (`/PLAN`), tests verts, pas de valeurs magiques, pas de code mort.
3. Cette auto-review reste legere : elle ne remplace jamais la revue humaine (dev auteur + 2 collegues) qui aura lieu sur la MR apres `/SHIP`.
4. Note les points d'attention pour les relecteurs humains dans le `contextSummary`.
5. Appelle `update_checkpoint` avec `checkpoint: "reviewed"` et ce `contextSummary`.
6. Rappelle que l'etape suivante est `/CODE-SIMPLIFY`.
