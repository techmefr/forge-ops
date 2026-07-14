# demo-app

Petite API de notes (in-memory, `GET/POST/DELETE /notes`) qui ne fait partie d'aucun outillage starfleet. Son seul role : servir de "vrai" code metier pour tester la sequence `/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP` sur autre chose que starfleet lui-meme, en attendant une validation externe sur un projet applicatif complet (voir section 0 et 15 du README racine).

## Lancer

```bash
npm run example:dev
npx vitest run examples/demo-app
```

## Dogfooder une feature dessus

1. `git worktree add ../starfleet-demo-feature -b feature/demo-app-<nom>` (le nom de branche alimente `allocatePort` : port et checkpoint restent isoles de la branche `main`)
2. Dans ce worktree, lancer `/SPEC` puis suivre la sequence jusqu'a `/SHIP` en modifiant uniquement `examples/demo-app/`
3. `list_worktrees` / `get_worktree_status` (outils MCP) donnent l'etat de la tache pendant l'operation

Les frictions reelles de la methodologie (checkpoints mal ecrits, gating trop strict ou pas assez, dashboard qui ne reflete pas l'etat) sont plus faciles a reperer ici que sur le code de starfleet lui-meme, qui est deja construit par la methodologie et donc biaise pour la juger.
