# Starfleet — notes de session & feuille de route

> Fichier de reprise. Résume ce qui a été fait, les décisions, les vrais problèmes
> qui motivent le projet, et le chantier cible. Branche : `refactor/human-driven-orchestration`.

## 1. Ce que starfleet est devenu

Socle **piloté par un humain** pour aider les devs à travailler avec les Git Worktrees,
avec une **source de vérité unique** (SQLite) sur l'état de chaque worktree, exposée via
un serveur MCP + un dashboard **interactif**. Pas de pipeline autonome.

**Architecture clé : une logique, deux transports.** Toute l'orchestration vit dans
`src/operations.ts` (create/launch/start/stop/cleanup/escalate/checkpoint/items). Le serveur
MCP (outils) **et** le dashboard (endpoints HTTP) appellent cette même couche — aucune
duplication. Le dashboard n'est donc plus read-only : il crée/lance/démarre/arrête/nettoie/
escalade et gère les tâches, exactement comme les outils MCP.

## 2. Décisions structurantes (déjà appliquées)

- **Pas d'auto-mode.** La friction n°1 (TDD contournable) venait de l'agent autonome →
  on supprime la cause. Conséquence : retrait des caps tentatives/actions, détection de
  boucle, heartbeat/staleness (babysitting d'agent non surveillé).
- **On s'appuie sur le natif Claude Code**, pas de couches maison : deny-rules →
  permissions/hooks natifs ; review → `/code-review` + `/security-review` ; modèle →
  `/model` ; mémoire → compaction native. (deny/model-router/doc-freshness supprimés.)
- **Clé d'allocation = (projet + branche)** + unicité globale des ports (index unique sur
  `port`). Deux projets ne peuvent plus réserver le même port, même avec des branches
  homonymes.
- **`cleanup` détruit réellement la worktree git** (`git worktree remove`), pas juste la
  ligne SQLite.
- **Dashboard** : refonte (grille 4px, échelle typo nombre d'or, thème clair/sombre),
  panneau réglages (langue+pays, slider de police, thème) fermé au clic extérieur,
  accessibilité RGAA (contrastes ≥ 4.5:1 vérifiés, focus visible, labels aria), logo +
  favicon fusée, bouton refresh, **responsive en cards** (< 900px, plus de scroll horizontal).
- **Multi-projet / runtime** : `launch_worktree` (git worktree add), `start_server` /
  `stop_server` (spawn/kill + PID, injection `PORT`), `add_task_item` / `toggle_task_item`,
  champ `feature` (groupe front+back). Dashboard : état **live/down** (sonde TCP), lien
  **Ouvrir** (front sans connaître l'URL), colonnes Feature/Tâches.

Tout ça est vérifié : build + 26 tests verts, worktree add/remove réel OK, spawn/kill +
sonde live OK.

## 3. Les vrais problèmes terrain (le « pourquoi »)

Ce qui motive le projet, remonté du quotidien :

1. **Deux projets, mêmes ports de back** → blocage.
2. **Vieux projet** relancé qui **collisionne** avec d'autres → chasse manuelle de ports libres.
3. **Doublons de worktree** : un dev fait deux worktrees pour une tâche similaire → doublon.
4. **Code dupliqué entre tâches** : deux tâches partagent du commun, chacune le réécrit dans
   sa worktree isolée → duplication + divergence + conflits.
5. (Mailpit Sail remappé 8025→8125 : config Sail, **hors scope** starfleet, mais même racine
   = éviter les collisions.)

**Racine commune :** absence d'une **couche de coordination partagée** + pas de **vue
d'ensemble** de ce qui tourne / de qui bosse sur quoi.

## 4. Est-ce que l'idée corrige ces soucis ?

Oui sur le principe (c'est sa thèse), **à deux conditions** que le prototype ne remplit pas
encore :

- **Couverture + propriété des ports** : starfleet doit être adopté par *tous* les projets
  et **réécrire leur config de ports** (Sail `.env`), sinon un projet non-coordonné recrée
  la collision.
- **État partagé équipe** : la dédup et la visibilité multi-devs exigent un état central
  (rôle de **FLEET**), pas une base SQLite locale qui ne voit que ton poste.

## 5. Chantier cible (la convergence)

**Graphify qui gère l'ensemble des worktrees**, pour voir vite les doublons et corriger :

1. **Agrégation (facile)** — starfleet connaît les chemins de toutes les worktrees → il les
   donne à **graphify** qui construit **un seul graphe** couvrant l'ensemble.
2. **Détection de doublons (le morceau neuf)** — un graphe brut ne signale pas les doublons ;
   il faut une **passe de similarité** (nom + signature + structure/embeddings) entre
   worktrees. Cibler le vrai signal (deux branches réinventent le même helper) et non le
   faux positif (même fichier édité dans deux branches, réglé au merge).
3. **Corriger** — le graphe **fait voir** (gros gain) ; extraire le commun (module/branche
   partagée) reste un **refactor coordonné**, décision humaine.

**Flux « pour bien faire » :** `/SPEC` (quoi) → **archi** (graphify : qu'est-ce qui existe
déjà, où ça se branche — l'étape qui évite les doublons) → **voir dedans** (le code réel,
dans la worktree/l'éditeur). Rôles : méthodo = SPEC ; graphify = archi/notes/mindmap ;
worktree+éditeur = le code ; **starfleet = le liant** (lance la worktree, relie tâche→archi).

## 6. Backlog (priorisé)

1. **chemin repo par projet** (prérequis, partiellement là via `repoPath`) →
2. allocation de port **consciente des ports occupés** (niveau 1 : sonde à l'allocation ;
   niveau 2 : scan des `docker-compose`/`.env` pour les ports réservés hors ligne).
3. **mode Docker/stack** (Sail) : `docker compose up/down` par worktree + santé conteneurs,
   au lieu du spawn de process bare. Lien vers Portainer pour logs/détails.
4. **détection de doublons** de worktree (identité de tâche : `role` front/back ou ticket ;
   warning à `create_task`).
5. **état partagé équipe** (FLEET) pour dédup + visibilité multi-devs.
6. **vue archi agrégée** = starfleet liste les projets + embarque graphify (+ passe de dédup).

## 7. Défauts retenus (à confirmer/ajuster)

- URL front : `http://localhost:<port>` (env `STARFLEET_URL_HOST`). Traefik/sous-domaines : plus tard.
- Process : starfleet spawn/kill lui-même (injecte `PORT`), garde le PID.
- Worktree créée en dossier voisin `<repo>-worktrees/<slug>`.
- `feature` = groupe reliant plusieurs worktrees (front + back).
- Archi = **déléguée à graphify** (pas de moteur d'intelligence dans starfleet).
- Dashboard sur **4998** (`STARFLEET_DASHBOARD_PORT`) car 4999 était pris ; lit aussi `PORT` en repli.

## 8. Questions ouvertes

- Front et back : repos **séparés** ou même repo, chez vous ?
- Une **« tâche »** = sous-tâches atomiques du `/PLAN` / to-do libre / lien ticket Jira ?
- Notes d'archi par fichier : **auto (graphify)** / **manuelles** / **les deux** ?
- Schéma d'URL : `localhost:<port>` vs **Traefik/sous-domaines** ?

## 9. Pour reprendre (commandes)

```bash
npm install
npm run db:init          # applique le schéma SQLite (WAL)
npm run build            # tsc
npm test                 # vitest (26 tests)
npm run mcp              # serveur MCP (stdio) — déclaré dans .mcp.json
STARFLEET_DASHBOARD_PORT=4998 npm run dashboard   # dashboard read-only
```

Prochaine étape suggérée : lancer **graphify** sur un vrai projet (starfleet ou
formation-laravel) pour valider l'étape « archi », puis prototyper la **passe de dédup**
cross-worktree (le seul vrai morceau qui n'existe pas encore).
