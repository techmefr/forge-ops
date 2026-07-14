# Starfleet — Méthodologie de développement assisté par agents IA

## 0. Contexte et positionnement du projet

**Nom du projet : `starfleet`** (repo `techmefr/starfleet`).

**D'où ça vient :** ce document part d'un workflow existant (documenté dans un PDF de référence) reposant sur Git Worktrees + agents IA + Docker + Traefik, avec trois frictions réelles constatées à l'usage. On a volontairement retiré le nom du projet d'origine pour extraire une méthodologie générique, réutilisable indépendamment du contexte initial.

**Relation avec les autres projets internes :**
- **FLEET** est le projet parent / la flotte-mère : outil visuel de gestion des sessions d'agents Claude Code, des worktrees Git, des stacks Docker et du pipeline multi-IA challenge. `starfleet` est le **socle méthodologique et l'orchestration bas niveau** — la mécanique interne (état, gating, checkpoints) que FLEET peut consommer ou visualiser par-dessus.
- **Aegis** reste un projet séparé et dédié : pilote QA/Playwright (génération de specs de test à partir d'un dialogue PO/challenge), scope produit précis sur Stacktim. `starfleet` ne duplique pas ce rôle. **Point d'intégration futur identifié, non implémenté pour l'instant :** l'étape `/TEST` de la séquence starfleet pourrait à terme déléguer la génération de tests à Aegis plutôt que la réinventer.

**Stratégie de validation retenue :** dogfooding. On teste et on construit `starfleet` **sur son propre repo** en premier — on développe l'outil en utilisant la séquence `/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP` sur son propre code. Avantage : les frictions de la méthodologie apparaissent immédiatement pendant la construction, pas besoin d'un deuxième repo pour les révéler. Une fois la mécanique stable (SQLite, MCP server, gating) sur `starfleet` lui-même, prévoir une **deuxième passe de validation externe** sur un vrai projet applicatif (ex. Pilota ou un sandbox), car un outil pour agents peut sembler fonctionner sur lui-même tout en masquant des problèmes qui n'apparaissent que sur du code métier classique.

---

## 1. Les frictions de départ (constat initial)

Le workflow d'origine documentait trois frictions réelles :

1. **Fragilité de l'auto-mode IA** — le TDD généré par l'agent peut être masqué/contourné, code livré sans garantie réelle que les tests couvrent quelque chose de solide.
2. **Désynchronisation état réel / dashboard** — ce que montre l'interface de suivi ne reflète pas fidèlement ce qui se passe réellement dans les worktrees/conteneurs, notamment en cas de crash en cours d'opération.
3. **Conflits de ports/domaines dynamiques** — l'allocation à la volée de ports/domaines pour chaque environnement génère des collisions.

**Solutions initialement envisagées (issues du document de référence) :**
- Revue humaine systématique de tout changement généré par un agent avant merge
- Listener `inotify` (ou équivalent) pour pousser les changements de fichiers vers le dashboard en temps réel
- Orchestrateur centralisé (Vue.js + Tailwind) comme source de vérité unique pour l'état des agents, worktrees et routage

---

## 2. Le challenge de ces solutions — ce qui a été soulevé

Chacune des trois solutions initiales a été passée au crible pour trouver ses angles morts :

**Revue humaine systématique**
- Réintroduit exactement le goulot d'étranglement que l'auto-mode était censé supprimer. Si chaque changement doit être relu, le gain de vélocité de l'IA s'effondre.
- Le vrai risque n'est pas « pas de relecture » mais « relecture superficielle qui rassure sans rien attraper » — un humain fatigué qui valide du code TDD généré en masse fait pire que pas de relecture du tout, avec un faux sentiment de sécurité.

**Listener inotify**
- Résout la latence d'affichage, pas la désynchronisation elle-même. Si l'agent modifie un fichier puis crash avant de finir une opération multi-fichiers, `inotify` affiche fidèlement un état incohérent en temps réel — le problème est vu plus vite, mais il existe toujours.
- Fragilité classique : perte d'événements sous forte charge, watchers qui ne suivent pas les renommages/déplacements de dossiers (fréquent avec des worktrees qui apparaissent/disparaissent).
- Il manquait une notion de **source de vérité versionnée** (reconciliation périodique entre l'état déclaré par Docker/Git et ce qu'affiche le dashboard), pas juste du temps réel.

**Orchestrateur centralisé Vue.js + Tailwind**
- Déplace le problème : il devient un SPOF. Si le service qui gère l'attribution de ports/domaines tombe ou a un bug d'état, on perd la capacité de créer/détruire des environnements — potentiellement pire que des conflits ponctuels.
- Rien n'était dit sur la stratégie de récupération après crash de l'orchestrateur lui-même.
- Le choix Vue.js/Tailwind est une décision d'implémentation, pas une réponse au problème de fond. Le vrai levier méthodologique : allocation déterministe (hash du nom de branche → port/sous-domaine reproductible) pour éliminer la classe de conflit à la source.

**Le point commun aux trois angles morts :** les solutions traitaient les symptômes visibles (pas de revue, pas de temps réel, pas de vue unifiée) sans garantir la **cohérence d'état sous échec partiel** — c'est là qu'était la vraie source de friction.

---

## 3. Décisions retenues — la reconstruction

Plutôt que relecture humaine + inotify + orchestrateur Vue, les principes retenus :

1. **Déterminisme bête plutôt qu'allocation dynamique** — ports/domaines calculés par hash du nom de branche (`hash(branch_name) % range + base_port`). Zéro allocation, zéro conflit, à la source.
2. **Une source de vérité unique, facile à vérifier** — une table SQLite (mode WAL) qui trace chaque opération (création worktree, test lancé, conteneur up/down). Dashboard et serveur MCP lisent tous les deux cette même table. Polling simple ~1s plutôt que listener système fragile — largement suffisant à cette échelle.
3. **Gating simple et non contournable** — règle d'or : aucun merge sans tests verts, peu importe qui a généré le code. Cap de tentatives (5), au-delà escalade vers un humain.
4. **Deux interfaces sur la même source, jamais deux sources à synchroniser** — un serveur MCP conversationnel (tools utilisables depuis Claude Code/Desktop, ex. « montre-moi les worktrees en échec ») et un dashboard web léger en lecture seule. Le MCP a été retenu de préférence à une UI Vue.js complète : zéro frontend à maintenir, ça reste dans le flux de travail existant.
5. **La revue humaine n'a pas été perdue, juste repositionnée** — elle existait déjà dans le workflow réel, sur la MR (dev auteur + 2 collègues), après le gating automatique plutôt qu'en double emploi avec lui. Pas besoin de la dupliquer en amont.

**Ce que ça enlève par rapport aux solutions de départ :** pas d'inotify, pas d'orchestrateur centralisé séparé, pas de revue humaine systématique en double emploi. Juste une table d'état + une règle de gating + un calcul déterministe des ports.

**Bilan honnête de cette reconstruction (angles morts assumés consciemment) :**
- SQLite + WAL est calibré pour ~10 agents en parallèle avec écritures ponctuelles. Si l'usage change fortement (beaucoup plus d'agents, écritures très fréquentes), il faudra revisiter vers Postgres — ce n'est pas une faiblesse de conception, c'est une limite connue et assumée.
- Deux vrais trous identifiés et comblés par la suite (voir sections 5 et 6) : la reprise après crash de l'agent lui-même (pas juste l'état affiché), et les boucles d'erreur répétées.

---

## 4. Architecture retenue

- **Isolation** : chaque tâche/feature démarre dans un Git Worktree dédié, jamais sur la branche principale.
- **Source de vérité unique** : une base **SQLite** (mode WAL activé) contenant une table `tasks`. Le dashboard et le serveur MCP lisent tous les deux cette même table — aucun état dupliqué.
- **Ports/domaines déterministes** : calculés par hash du nom de branche (ex. `hash(branch_name) % range + base_port`). Zéro allocation dynamique, zéro conflit.
- **Deux interfaces sur la même source** :
  - Un **serveur MCP** (tools conversationnels, utilisables depuis Claude Code/Desktop)
  - Un **dashboard web léger** (lecture seule, polling ~1s sur la table `tasks`)
- Le dashboard ne décide jamais rien. Toute la logique (gating, cap tentatives, cleanup) vit dans les tools MCP ou le pipeline agent.

---

## 5. Schéma de la table `tasks` (SQLite, WAL)

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch TEXT NOT NULL UNIQUE,
  port INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
    -- created | testing | failed | done | escalated | awaiting_human

  -- Séquence de commandes / checkpoints
  last_checkpoint TEXT,
    -- spec_done | plan_done | tests_written | build_done | reviewed | simplified | mr_draft_pushed

  -- Reprise après crash
  heartbeat TIMESTAMP,
  context_summary TEXT,
    -- résumé condensé écrit par l'agent à chaque checkpoint, relu à la reprise

  -- Garde-fous anti-boucle
  attempt_count INTEGER DEFAULT 0,
  action_count INTEGER DEFAULT 0,
  last_error_hash TEXT,

  -- Model router
  recommended_model TEXT,
  current_model TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

---

## 6. Séquence de commandes de l'agent (par worktree)

Ordre obligatoire, chaque étape écrit son checkpoint avant de passer à la suivante :

1. **`/SPEC`** — verrouiller ce qui doit être construit avant la moindre ligne de code → `checkpoint: spec_done`
2. **`/PLAN`** — découper en tâches atomiques, pas de dérive de scope → `checkpoint: plan_done`
3. **`/TEST`** — écrire les tests comme preuve que le code marchera (TDD) → `checkpoint: tests_written`
4. **`/BUILD`** — construire par incréments, jamais tout d'un coup → `checkpoint: build_done`
5. **`/REVIEW`** — auto-review légère de l'agent (ne remplace pas la revue humaine en MR) → `checkpoint: reviewed`
6. **`/CODE-SIMPLIFY`** — refactorer le code malin en code clair → `checkpoint: simplified`
7. **`/SHIP`** — push + ouverture MR en **draft**, avec reviewers assignés (dev + 2 collègues), template et labels conformes aux conventions du repo → `checkpoint: mr_draft_pushed`, `status: awaiting_human`

**Règle d'or non négociable :** tests verts obligatoires avant tout passage à `/SHIP`, peu importe qui a écrit le code.

À chaque checkpoint franchi, l'agent écrit un résumé condensé dans `context_summary` (ce qui a été fait, décisions prises, points d'attention). À la reprise après crash, l'agent relit `context_summary` + `last_checkpoint` avant de continuer — jamais de redémarrage à zéro.

*Origine de cette séquence de commandes : inspirée des concepts `/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP` (source : @automatise_avec_igor), adoptés intégralement.*

---

## 7. Gating et garde-fous anti-boucle

- **Cap de tentatives** : `attempt_count` incrémenté à chaque relance. Cap dur à 5 → au-delà, `status = escalated`.
- **Détection de boucle d'erreur** : si `last_error_hash` identique sur 2 tentatives consécutives sans changement de diff → escalade immédiate, ne pas attendre la 5e tentative.
- **Cap d'actions** : `action_count` incrémenté à chaque tool call/edit de l'agent. Plafond dur à 50 → au-delà, `status = escalated, reason = action_limit_exceeded`, peu importe si les tests passent.
- **Détection de staleness** : watcher périodique (cron ou tool MCP `check_stale_tasks`). Si `heartbeat` non mis à jour depuis X minutes ET `status != done` → tâche considérée crashée, reprise depuis `last_checkpoint`.

---

## 8. Règles DENY (sécurité)

Fichier `.claude-deny.json` versionné dans le repo, vérifié par le hook MCP avant exécution de toute commande par l'agent :

```json
{
  "deny": [
    "rm -rf*",
    "git push --force*",
    "DROP TABLE*",
    "> /dev/*"
  ]
}
```

Toute commande matchant un pattern deny n'est **jamais exécutée**, quel que soit le contexte. Pas de dépendance externe — pattern matching simple, à intégrer dans le pipeline avant `/BUILD`.

---

## 9. Model Router (optimisation de coût)

Hook local (script Python ou Node) qui recommande — sans jamais basculer automatiquement — le modèle adapté à chaque étape :

| Étape | Modèle recommandé | Raison |
|---|---|---|
| `/SPEC`, `/CODE-SIMPLIFY` | Opus | architecture, décisions structurantes |
| `/PLAN`, `/BUILD`, `/TEST` | Sonnet | dev standard |
| Tâches mécaniques (renommage, formatage) | Haiku | faible complexité |
| Écriture, copy, design, branding | Fable | tâches créatives |

Le hook écrit sa recommandation dans `recommended_model`. La bascule reste **manuelle** via `/model`, jamais automatique — pour éviter tout changement de comportement non maîtrisé en cours de tâche.

---

## 10. Vérification de fraîcheur de doc

Tool MCP `check_doc_freshness(package)` : compare la version d'une dépendance utilisée dans le projet à la dernière version publiée (npm registry, Packagist, etc.). Appelé automatiquement en début de `/SPEC` si le prompt mentionne une dépendance externe. Objectif : éviter que l'agent code contre une doc ou une API obsolète.

---

## 11. Outils tiers évalués

**Pertinents, à évaluer/intégrer plus en détail :**
- **Shepherd** — « Git pour agents IA » : chaque action de l'agent devient réversible, inspectable, rejouable avant de toucher les fichiers réels. Identifié comme la brique qui pourrait remplacer ou compléter la reprise après crash actuelle (checkpoint/heartbeat) par un vrai historique versionné des actions, rejouable/annulable. À creuser sérieusement.
- **GLYPH** (MCP, symbol outlines de la codebase) — utile pour que l'agent comprenne la structure avant d'agir, plutôt que de tout rescanner. Pertinent pour le pipeline Aegis/Claude Code.
- **PLAYWRIGHT** — cohérent avec l'existant côté Aegis.
- **FIRECRAWL** — scraping propre de docs pour donner du contexte à l'agent.
- **CHROME (live tabs → contexte capturé)** — intéressant pour capturer l'état visuel/contexte du navigateur pendant les tests.

**Écartés (bruit marketing, pas de lien direct avec isolation worktree / gating / méthodologie agent) :** Agency Agents, LibreChat, Open Higgsfield AI, Agent Reach, Agentic Inbox, Voicebox, Open-LLM-VTuber, HyperFrames, ZoeyOS.

**Reconstruits en interne plutôt qu'empruntés :** deny rules, model router, mémoire de session (`context_summary` dans la table plutôt qu'un plugin externe type "claude mem"), doc freshness (plutôt que dépendre de Context7).

---

## 12. Ce qui reste hors scope (assumé)

- Pas de revue humaine automatisée de la qualité du code généré — ce rôle est déjà couvert par la MR + 2 collègues, en dehors du pipeline agent.
- SQLite + WAL est dimensionné pour ~10 agents en parallèle avec écritures ponctuelles. Revoir vers Postgres seulement si l'usage change fortement (beaucoup plus d'agents, écritures très fréquentes).
- Pas de couplage avec Aegis pour l'instant — point d'intégration futur noté (section 0), non implémenté.

---

## 13. Ordre d'implémentation suggéré pour cette session

1. Schéma SQLite (section 5) + script d'init avec WAL activé
2. Serveur MCP minimal : `list_worktrees`, `get_worktree_status(branch)`, `escalate(branch, reason)`, `cleanup(branch)`, `check_stale_tasks`
3. Règles DENY (section 8) — le plus simple à isoler et tester seul
4. Intégration des checkpoints dans la séquence de commandes (section 6)
5. Model router (section 9) — hook indépendant, peut être développé en parallèle
6. Dashboard web léger (lecture seule sur la table `tasks`)
7. `check_doc_freshness` (section 10) — en dernier, moins critique

**Stratégie de test (rappel section 0) :** dogfooding sur le repo `starfleet` lui-même avant validation sur un projet externe (Pilota ou sandbox).

---

## 14. Installation et usage

### Prerequis

- Node.js 22+
- Entree `/etc/hosts` : `127.0.0.1 starfleet.local` (une fois, sudo) — pour ne jamais exposer "localhost" dans les URLs des outils starfleet

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
| `npm run dashboard` | Demarre le dashboard en lecture seule (`http://starfleet.local:4999`) |
| `npm test` | Lance la suite de tests |
| `npm run build` | Compile le TypeScript |

Le serveur MCP est deja declare dans `.mcp.json` : il est disponible automatiquement dans une session Claude Code ouverte a la racine de ce repo (premiere ouverture : Claude Code demande confirmation de confiance sur le serveur).

### Skills et commandes locales

- `.claude/commands/` : la sequence `/SPEC /PLAN /TEST /BUILD /REVIEW /CODE-SIMPLIFY /SHIP`, chaque etape ecrit son checkpoint via l'outil MCP `update_checkpoint`.
- `.claude/skills/` : methodologie embarquee (clarification de perimetre, TDD, debogage systematique, verification avant livraison, discipline de revue), ecrite directement dans le repo plutot que dependante d'un plugin externe telecharge — meme logique que les regles DENY et le model router (section 11) : reconstruit en interne plutot qu'emprunte, pour que le repo reste autonome et versionne avec le code qu'il gouverne.
- `.claude-deny.json` + `scripts/deny-hook.mjs` : hook `PreToolUse` reel (voir `.claude/settings.json`), pas juste une bibliotheque — une commande matchant un pattern deny n'est jamais executee.

### Structure

```
db/                 schema SQLite + script d'init
src/db/              connexion + CRUD sur la table tasks
src/ports.ts          allocation deterministe port/sous-domaine par hash de branche
src/deny/             verification des commandes interdites
src/router/            recommandation de modele par etape
src/mcp/               serveur MCP et ses tools
src/dashboard/          dashboard web read-only (Express + i18n cote client)
.claude/commands/       sequence /SPEC ... /SHIP
.claude/skills/         methodologie embarquee (TDD, debogage, verification, revue, clarification)
scripts/deny-hook.mjs   hook PreToolUse qui applique .claude-deny.json
```

---

## 15. État d'implémentation

| Section | Statut |
|---|---|
| 4. Architecture (isolation, source de verite, ports, MCP + dashboard) | Fait, sauf creation/suppression reelle de la worktree git elle-meme (le tool `cleanup` ne supprime que la ligne en base) |
| 5. Schema `tasks` | Fait |
| 6. Sequence de commandes | Fait |
| 7. Gating anti-boucle | Fait, sauf le watcher periodique automatique — `check_stale_tasks` existe comme tool appelable a la demande, pas encore ordonnance par un cron |
| 8. Regles DENY | Fait, hook reel branche |
| 9. Model router | Fait, bascule manuelle comme prevu |
| 10. `check_doc_freshness` | Fait |
| 11. Outils tiers | Non integres (Shepherd, GLYPH, Playwright, Firecrawl, Chrome) — evaluation ouverte, non implementee par choix |
| 12. Hors scope | Assume tel quel |
