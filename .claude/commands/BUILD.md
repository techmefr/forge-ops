---
description: Construire par increments, jamais tout d un coup
---

Etape 4 de la sequence starfleet. Prerequis : `checkpoint: tests_written`. Si absent, arrete-toi et demande `/TEST`. Skills locales associees : `test-driven-development`, `systematic-debugging`.

1. Appelle `recommend_model` avec `step: "BUILD"` pour la branche courante et rapporte la recommandation.
2. Avant chaque commande shell, verifie qu'elle ne correspond a aucun pattern de `.claude-deny.json` (voir `src/deny/check.ts`). Une commande matchee n'est jamais executee, quel que soit le contexte.
3. Construis par increments atomiques, un element du plan a la fois. Apres chaque tool call ou edit significatif, appelle `record_action` pour incrementer le compteur d'actions (plafond dur a 50, escalade automatique au-dela peu importe si les tests passent).
4. Fais tourner les tests regulierement. Si un echec se repete a l'identique, appelle `record_error` : ne pas attendre la 5e tentative si la boucle est detectee immediatement.
5. A chaque relance apres echec, appelle `record_attempt` (cap dur a 5, escalade automatique au-dela).
6. Une fois tous les tests verts et le plan integralement construit, appelle `update_checkpoint` avec `checkpoint: "build_done"` et un `contextSummary` decrivant ce qui a ete construit et l'etat des tests.
7. Rappelle que l'etape suivante est `/REVIEW`.
