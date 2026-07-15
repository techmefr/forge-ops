# Starfleet — orchestration bas niveau pour dev assiste par agents IA

## 0. Positionnement

**starfleet** aide les devs a **travailler avec des Git Worktrees** et donne une **source de verite unique** sur l'etat de chaque worktree (branche, port, checkpoint courant). C'est un outil d'equipe, **pilote par un humain** : le dev conduit, starfleet trace et outille.

Ce n'est **pas** un pipeline autonome : il n'y a pas de mode auto qui enchaine tout seul spec → ship. Cf. section 2 pour la raison.

**Relation avec les autres projets internes :**
- **FLEET** est la flotte-mere : outil visuel de gestion des sessions d'agents, worktrees et stacks. `starfleet` est le socle bas niveau (etat, ports, tools MCP) que FLEET peut consommer.
- Les **agents** (review, verification, etc.) sont une piste separee, amelioree au fil de l'eau — hors scope de ce repo.

**Ce qui a ete volontairement retire** (et pourquoi c'est mieux) : voir section 3.

---

## 1. Les frictions de depart

Le workflow d'origine documentait trois frictions :

1. **Fragilite de l'auto-mode IA** — le TDD genere par un agent autonome peut etre masque/contourne, code livre sans garantie reelle.
2. **Desynchronisation etat reel / dashboard** — l'interface ne reflete pas fidelement ce qui se passe dans les worktrees/conteneurs.
3. **Conflits de ports/domaines** — l'allocation a la volee genere des collisions.

---

## 2. Decisions retenues

1. **Pas d'auto-mode.** La friction n°1 vient de l'agent autonome. Plutot que d'ajouter un enforcement complexe pour le mettre en cage, on supprime la cause : le dev reste aux commandes, il est l'enforcement. Consequence directe : plus besoin de caps de tentatives/actions, de detection de boucle, ni de reprise-apres-crash — toute cette mecanique de babysitting d'agent autonome a ete retiree.
2. **Determinisme + resolution de collision pour les ports.** Port de depart = `hash(branch) % range + base`. Comme deux branches peuvent hasher sur le meme port, `resolvePort` sonde lineairement jusqu'a un port libre. Determinisme != absence de collision : les deux sont necessaires.
3. **Une source de verite unique, simple a verifier** — une table SQLite (mode WAL). Dashboard et serveur MCP lisent la meme table. Polling ~1s cote dashboard.
4. **On s'appuie sur le natif Claude Code, on ne le reimplemente pas.** Permissions/hooks natifs pour bloquer des commandes, `/code-review` et `/security-review` pour la revue, `/model` pour le choix de modele, memoire/compaction native pour le contexte. starfleet ne duplique aucune de ces briques (les versions maison precedentes — deny-rules, model-router, doc-freshness — ont ete retirees).
5. **La revue humaine reste sur la MR** (dev auteur + 2 collegues), apres la sequence, comme avant.

---

## 3. Architecture

- **Isolation** : chaque tache/feature vit dans un Git Worktree dedie.
- **Source de verite** : table SQLite `tasks` (WAL). Aucun etat duplique.
- **Ports deterministes anti-collision** : `src/ports.ts` (`allocatePort` + `resolvePort`).
- **Deux interfaces sur la meme source** :
  - un **serveur MCP** (tools conversationnels depuis Claude Code) ;
  - un **dashboard web read-only** (polling ~1s).
- Le dashboard ne decide rien ; toute la logique vit dans les tools MCP.

---

## 4. Schema de la table `tasks`

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch TEXT NOT NULL UNIQUE,
  port INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
    -- created | in_progress | done | escalated | awaiting_human
  last_checkpoint TEXT,
    -- spec_done | plan_done | tests_written | build_done | reviewed | simplified | mr_draft_pushed
  context_summary TEXT,          -- notes de worktree lisibles, tenues a jour par le dev
  escalation_reason TEXT,        -- renseigne quand un dev escalade manuellement
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Le mode WAL et le `busy_timeout` sont appliques a l'ouverture de la connexion (`src/db/connection.ts`), pas dans le schema.

---

## 5. Sequence de commandes (guide humain, par worktree)

Sequence conseillee, chaque etape ecrit son checkpoint. Ce sont des **garde-fous pour le dev**, pas un enchainement automatique :

1. **`/SPEC`** → `spec_done`
2. **`/PLAN`** → `plan_done`
3. **`/TEST`** (TDD) → `tests_written`
4. **`/BUILD`** → `build_done`
5. **`/REVIEW`** (auto-review legere ; pour aller plus loin, `/code-review` et `/security-review` natifs) → `reviewed`
6. **`/CODE-SIMPLIFY`** → `simplified`
7. **`/SHIP`** — push + MR en **draft** (dev + 2 collegues) → `mr_draft_pushed`, `status: awaiting_human`

**Regle d'or : tests verts avant `/SHIP`.** A chaque checkpoint, le dev/agent ecrit un resume lisible dans `context_summary`.

*Origine de la sequence : concepts `/SPEC .../SHIP` (source : @automatise_avec_igor).*

---

## 6. Outils MCP exposes

- `create_task(branch)` — enregistre une worktree, port deterministe anti-collision.
- `update_checkpoint(branch, checkpoint, contextSummary)` — franchit un checkpoint.
- `list_worktrees(status?)` — liste les taches suivies.
- `get_worktree_status(branch)` — statut complet d'une worktree.
- `escalate(branch, reason)` — flag manuel « bloquee, besoin d'un humain ».
- `cleanup(branch)` — **supprime reellement la worktree git** (`git worktree remove`) puis la ligne en base.

---

## 7. Installation et usage

### Prerequis
- Node.js 18+
- Entree `/etc/hosts` : `127.0.0.1 starfleet.local` (pour ne pas exposer `localhost`).

### Installation
```bash
npm install
npm run db:init
```

### Scripts
| Commande | Effet |
|---|---|
| `npm run db:init` | Applique le schema SQLite (mode WAL) |
| `npm run mcp` | Demarre le serveur MCP en stdio |
| `npm run dashboard` | Dashboard read-only (`http://starfleet.local:4999`) |
| `npm test` | Lance la suite de tests |
| `npm run build` | Compile le TypeScript |

Le serveur MCP est declare dans `.mcp.json` : disponible automatiquement dans une session Claude Code ouverte a la racine du repo.

### Structure
```
db/                   schema SQLite + script d'init
src/db/               connexion + CRUD sur la table tasks
src/ports.ts          port deterministe + resolution de collision
src/git/worktree.ts   suppression reelle de la worktree git
src/mcp/               serveur MCP et ses tools
src/dashboard/         dashboard web read-only (Express + i18n cote client)
.claude/commands/      sequence /SPEC .../SHIP (guide humain)
.claude/skills/        methodologie embarquee (TDD, debogage, verification, revue, clarification)
```

---

## 8. Hors scope (assume)

- Pas de mode autonome — pilotage humain uniquement (section 2).
- Pas de couche deny/review/model-router/memoire maison — on utilise le natif Claude Code.
- SQLite + WAL dimensionne pour ~10 worktrees en parallele. Revoir vers Postgres si l'usage explose.
- Les agents (review, verification) sont une piste separee, hors de ce repo.
