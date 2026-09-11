---
description: Construire par increments jusqu au vert, jamais tout d un coup
---

Etape 4 de la sequence forge. Prerequis : `tests_written` prouve (`GET /api/stories/:id/dod`). Si absent, arrete-toi et demande `/TEST`. Skills locales associees : `test-driven-development`, `systematic-debugging`.

1. Construis par increments atomiques, un element du plan a la fois, en restant dans les chemins annonces a `/PLAN`.
2. Ecris le minimum de code qui fait passer le test courant. Pas d'anticipation de fonctionnalites non demandees.
3. Le garde-fou deny (`.claude-deny.json`, applique par le hook `PreToolUse`) refuse les commandes destructrices avant execution. Il echoue ferme : si sa liste devient illisible, il bloque au lieu de laisser passer. Une commande refusee ne se contourne pas, elle se reformule.
4. Le board recoit les fichiers que tu edites via le hook `PostToolUse` et les attribue a la story. Tu n'as rien a declarer.
5. Si le meme echec se repete a l'identique, ne relance pas en boucle : diagnostique la cause avec `systematic-debugging`. Deux echecs identiques d'affilee sont un signal d'arret, remonte a l'humain plutot que d'insister.
6. Termine avec la suite entiere verte et le typage propre, pas seulement les tests du fichier touche.
7. Ecris dans `.claude/evidence/<REFERENCE>/build.md` ce qui a ete construit et la sortie du run vert, sous les sections `## Ce qui a ete construit` et `## Sortie du run` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose.
8. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"build_done","evidencePath":".claude/evidence/<REFERENCE>/build.md"}`.
9. Rappelle que l'etape suivante est `/CODE-SIMPLIFY`.
