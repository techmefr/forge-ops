---
description: Construire par increments, jamais tout d un coup
---

Etape 4 de la sequence starfleet. Prerequis : `checkpoint: tests_written`. Si absent, arrete-toi et demande `/TEST`. Skills locales associees : `test-driven-development`, `systematic-debugging`.

1. Construis par increments atomiques, un element du plan a la fois.
2. Fais tourner les tests regulierement. Si un echec se repete a l'identique sans progres, arrete-toi et signale-le au dev — ne boucle pas indefiniment.
3. Une fois tous les tests verts et le plan integralement construit, appelle `update_checkpoint` avec `checkpoint: "build_done"` et un `contextSummary` decrivant ce qui a ete construit et l'etat des tests.
4. Rappelle que l'etape suivante est `/REVIEW`.
