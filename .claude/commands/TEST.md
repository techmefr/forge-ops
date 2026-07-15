---
description: Ecrire les tests comme preuve que le code marchera (TDD)
---

Etape 3 de la sequence starfleet. Prerequis : `checkpoint: plan_done`. Si absent, arrete-toi et demande `/PLAN`. Skill locale associee : `test-driven-development`.

1. Ecris les tests correspondant aux taches atomiques du plan, avant tout code d'implementation. Les tests doivent echouer pour la bonne raison (absence d'implementation), pas a cause d'une erreur de setup.
2. Si une erreur bloque et se repete a l'identique, arrete-toi et signale-le au dev plutot que de boucler.
3. Une fois les tests ecrits (rouges, en attente d'implementation), appelle `update_checkpoint` avec `checkpoint: "tests_written"` et un `contextSummary` decrivant la couverture des tests et les cas limites geres.
4. Rappelle que l'etape suivante est `/BUILD`.
