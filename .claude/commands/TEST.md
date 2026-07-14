---
description: Ecrire les tests comme preuve que le code marchera (TDD)
---

Etape 3 de la sequence starfleet. Prerequis : `checkpoint: plan_done`. Si absent, arrete-toi et demande `/PLAN`. Skill locale associee : `test-driven-development`.

1. Appelle `recommend_model` avec `step: "TEST"` pour la branche courante et rapporte la recommandation.
2. Ecris les tests correspondant aux taches atomiques du plan, avant tout code d'implementation. Les tests doivent echouer pour la bonne raison (absence d'implementation), pas a cause d'une erreur de setup.
3. Si une erreur bloque l'ecriture des tests, appelle `record_error` avec un hash stable de l'erreur (par exemple un hash du message d'erreur normalise) : une boucle detectee sur 2 tentatives consecutives identiques declenche une escalade automatique.
4. Une fois les tests ecrits (rouges, en attente d'implementation), appelle `update_checkpoint` avec `checkpoint: "tests_written"` et un `contextSummary` decrivant la couverture des tests et les cas limites geres.
5. Rappelle que l'etape suivante est `/BUILD`.
