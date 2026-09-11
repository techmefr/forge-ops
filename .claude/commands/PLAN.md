---
description: Arreter l architecture de la story, sans deriver du perimetre
---

Etape 2 de la sequence forge. Prerequis : `spec_done` prouve. Verifie avec `GET /api/stories/:id/dod` ; si l'etape n'est pas prouvee, arrete-toi et demande `/SPEC`.

1. Lis `.claude/evidence/<REFERENCE>/spec.md`. Le plan reste strictement dans ce perimetre : toute derive constatee renvoie a `/SPEC`, elle n'est jamais absorbee en silence.
2. Propose l'architecture : ou vivent les fichiers (`technical/` ou `domain/`), quels objets, quelles frontieres. `technical/` ne depend jamais de `domain/`.
3. Nomme les chemins que la story va modifier. Consulte `GET /api/files/conflicts` : si une autre story edite deja un de ces chemins, signale-le avant de continuer plutot que de decouvrir le conflit au merge.
4. Fais valider le plan par l'utilisateur. Sans validation explicite, tu ne passes pas a l'etape suivante.
5. Ecris le plan retenu dans `.claude/evidence/<REFERENCE>/arch.md` : decoupage, ordre, chemins touches, risques. Titre les sections `## Decoupage` et `## Risques` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose.
6. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"arch_done","evidencePath":".claude/evidence/<REFERENCE>/arch.md"}`.
7. Rappelle que l'etape suivante est `/TEST`.
