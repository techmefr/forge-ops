# Starfleet — board story-driven pour sessions d'agents

Branche `forge`. Réécriture complète : l'unité de travail n'est plus la tâche, c'est la **story**, toujours accompagnée de sa **story de test jumelle**. Le board orchestre des sessions Claude Code sur ces stories et refuse de laisser une story avancer sans preuve.

## 1. Le problème traité

Un agent qui code seul produit trois classes de friction :

1. **Le TDD généré peut être mimé.** Un test écrit après le code, ou modifié pour passer, coûte plus cher que pas de test : il rassure.
2. **L'état affiché n'est pas l'état réel.** Un agent qui crashe au milieu d'une opération multi-fichiers laisse une base cohérente avec elle-même et fausse par rapport au disque.
3. **Les agents se marchent dessus.** Deux sessions qui touchent le même fichier sans le savoir produisent un conflit découvert au merge.

## 2. Les décisions retenues

- **Une story, une jumelle de test.** `story.kind` vaut `functional` ou `test`, la jumelle pointe la fonctionnelle par `twin_of_story_id`. Une story fonctionnelle ne quitte pas `drafting` sans sa jumelle, et le board refuse le checkpoint `spec_done` sans elle. Le périmètre se décrit sur deux objets, pas un.
- **Une étape se prouve par un fichier, jamais par une affirmation.** Chaque checkpoint exige un `evidence_path` (`NOT NULL` en base) pointant un fichier sous `.claude/evidence/<REFERENCE>/`. Pas de preuve, pas de checkpoint.
- **La séquence est ordonnée et le board l'applique.** Une étape franchie hors ordre, ou deux fois, est refusée en 409. Ce n'est pas une convention documentée, c'est un refus serveur.
- **Une source de vérité unique.** Une base SQLite en WAL, lue par l'API et par le board. Aucun état dupliqué à synchroniser.
- **Le garde-fou échoue fermé.** Le hook `PreToolUse` bloque la commande quand il ne peut pas décider — liste de deny illisible, charge utile incompréhensible. La version précédente échouait ouverte : supprimer le script supprimait silencieusement toute la protection.
- **L'attribution des fichiers vient des hooks, pas d'un watcher.** Claude Code poste chaque `Edit`/`Write` sur l'API ; le board sait quelle story a touché quel fichier et détecte les chemins revendiqués par plusieurs stories.
- **Déterminisme plutôt qu'allocation.** Port et sous-domaine dérivés d'un hash du nom de branche : la classe de conflit disparaît à la source.
- **La dernière porte est humaine.** Aucun agent ne passe une story en `done`.

## 3. Hiérarchie du travail

Un directeur écrit **uniquement des épiques** : le besoin métier de haut niveau. Les architectes IA décomposent l'épique en stories fonctionnelles, chacune avec sa jumelle de test. La story va jusqu'au code.

```
project → epic → story (functional) ─── twin_of ──→ story (test)
                   │
                   ├── acceptance_criterion
                   ├── story_dependency  (bloquée en attente d'une autre)
                   ├── checkpoint        (6 étapes, chacune avec sa preuve)
                   ├── agent_session → file_touch
                   └── review_finding    (quality | security | accessibility)
```

Le schéma complet est dans [db/forge.sql](db/forge.sql).

## 4. La séquence

Huit étapes, six checkpoints. `/PLAN` et `/CODE-SIMPLIFY` n'ont pas de checkpoint propre : le premier est prouvé par `arch_done`, le second est vérifié par la suite de tests déjà verte.

| Étape | Checkpoint prouvé | Preuve attendue |
|---|---|---|
| `/SPEC` | `spec_done` | `evidence/<REF>/spec.md` — périmètre, critères d'acceptation, hors scope, jumelle écrite |
| `/PLAN` | `arch_done` | `evidence/<REF>/arch.md` — découpage, placement dans les couches, risques |
| `/TEST` | `tests_written` | `evidence/<REF>/tests.md` — les tests **rouges**, sortie collée |
| `/BUILD` | `build_done` | `evidence/<REF>/build.md` — les mêmes tests verts, suite complète |
| `/CODE-SIMPLIFY` | — | comportement inchangé, suite toujours verte |
| `/VERIFY` | `verified` | `evidence/<REF>/verified.md` — le chemin de la story parcouru pour de vrai |
| `/REVIEW` | `reviewed` | `evidence/<REF>/reviewed.md` — cascade qualité → sécurité → accessibilité |
| `/SHIP` | — | validation humaine, puis `done` |

**Règles non contournables :**

- `spec_done` est refusé si la jumelle de test n'existe pas, et refusé si la story ne déclare **aucun critère d'acceptation** : sans critère il n'y a rien à valider, donc rien à bloquer au merge.
- `reviewed` est refusé tant qu'un critère d'acceptation n'est pas satisfait, et un critère ne se satisfait que **contre une preuve** — le test qui le couvre. Pas de case à cocher.
- `tests_written` doit constater un échec **de comportement**, pas une erreur d'import ou de setup. Un test qui passe dès sa première écriture doit être validé par mutation.
- `reviewed` est refusé tant qu'un finding `strong` n'est pas résolu (409 `UnresolvedFindingError`). Baisser la sévérité pour passer n'est pas une correction.
- `/SHIP` relit la definition of done complète : une seule étape à `proven: false` et il n'y a pas de livraison.
- Deux échecs identiques d'affilée pendant `/BUILD` sont un signal d'arrêt, pas une invitation à retenter.

La doctrine vit dans [.claude/commands/](.claude/commands) et [.claude/skills/](.claude/skills), versionnée avec le code qu'elle gouverne plutôt que dépendante d'un plugin externe.

## 5. API

Le board expose une API HTTP (Hono). `POST /api/hooks` est aussi la cible des hooks Claude Code.

| Route | Effet |
|---|---|
| `POST /api/stories` | Crée une story fonctionnelle |
| `POST /api/stories/:id/twin` | Écrit sa jumelle de test |
| `POST /api/stories/:id/backlog` | Envoie au backlog (refusé sans jumelle) |
| `GET /api/stories/backlog` | Liste le backlog |
| `GET /api/stories/:id/ticket` | Le ticket entier : volet fonctionnel, volet tests, critères, DoD, cascade |
| `POST /api/stories/:id/criteria` | Déclare un critère d'acceptation |
| `POST /api/criteria/:id/satisfy` | Satisfait un critère contre sa preuve |
| `POST /api/stories/:id/checkpoints` | Prouve une étape (`name`, `evidencePath`) |
| `GET /api/stories/:id/dod` | Definition of done : six étapes, prouvée ou non, avec sa preuve |
| `POST /api/hooks` | Reçoit les hooks Claude Code, enregistre les fichiers touchés |
| `POST /api/stories/:id/dispatch` | Lance une session sur une phase (`phase`) |
| `GET /api/events` | Flux SSE des mutations du board |
| `GET /api/board/phases` | Le contrat des phases et leurs prérequis |
| `GET /api/files/conflicts` | Chemins revendiqués par plus d'une story |
| `GET /api/fleet` | État des sessions d'agents lues chez Claude Code |
| `POST /api/stories/:id/scope` | Réserve un périmètre (dossier et symboles) pour une story |
| `DELETE /api/stories/:id/scope` | Rend tout ce que la story tenait |
| `GET /api/scope/reservations` | Les périmètres tenus, avec la story qui les tient |
| `GET /api/scope/collisions` | Les recouvrements que le board subit |
| `GET /api/sessions/history` | L'historique des sessions : durée, coût, classe de sortie |
| `GET /api/statistics` | Les totaux, les agents les plus sollicités, le temps par étape |
| `GET /api/incidents` | Les signalements venus du dehors, filtrés par état |
| `POST /api/origins/:slug/incidents` | Reçoit un signalement d'une source déclarée |
| `POST /api/incidents/:id/accept` | En fait une story et sa jumelle |
| `POST /api/incidents/:id/refuse` | Refuse le signalement, motif obligatoire |
| `GET`/`PUT /api/settings/budget` | Le plafond de coût et la conduite à tenir quand il tombe |

Codes retour : `404` story inconnue, `409` refus métier (violation de séquence, preuve manquante, dépendance non résolue, finding `strong` ouvert), `500` uniquement pour un vrai imprévu — un refus métier ne se déguise jamais en erreur serveur, et l'inverse non plus.

## 6. Garde-fou d'exécution

`.claude-deny.json` liste les commandes jamais exécutées. Le hook `PreToolUse` sur `Bash|PowerShell` sort en code 2 avec sa raison.

- Il inspecte la commande entière **et chaque segment** séparé par `&&`, `||`, `;`, `|` ou un retour ligne : `cd x && rm -rf y` ne passe plus.
- Il **échoue fermé** : payload illisible, commande absente, liste de deny introuvable → refus.
- `git push --force` et `-f` sont bloqués, `git push --force-with-lease` reste autorisé volontairement.

## 7. Accès à l'API

La menace n'est pas le réseau, c'est **le navigateur** : n'importe quelle page ouverte dans un onglet peut envoyer des requêtes sur `127.0.0.1`. Or `POST /api/stories/:id/dispatch` lance une session qui écrit dans le repo et consomme le forfait. Trois défenses, dans cet ordre.

1. **Le board n'écoute que la boucle locale.** `FORGE_HOST` vaut `127.0.0.1`. Ne le passer à `0.0.0.0` qu'une fois une vraie authentification multi-utilisateurs écrite.
2. **L'origine est vérifiée avant tout le reste.** Une requête portant un en-tête `Origin` inconnu part en `403`, même avec un jeton valide. C'est ce qui arrête une page web, parce qu'un navigateur envoie toujours `Origin` sur une requête d'origine croisée et ne peut pas l'omettre.
3. **Un jeton par board**, 32 octets aléatoires, écrit dans `.forge-token` (droits `600`, gitignoré) au premier démarrage. Comparé en temps constant.

**Le jeton du board ne voyage jamais dans une URL.** Une URL finit dans les journaux d'accès, l'historique du shell, les traces d'erreur et l'en-tête `Referer` : c'est le pire endroit pour un secret. Il se présente donc en `Authorization: Bearer`, en `X-Forge-Token`, ou dans le **cookie** `forge_token` — que `EventSource` envoie tout seul, ce qui règle le cas du flux SSE sans mettre quoi que ce soit dans l'adresse. En développement, le proxy vite pose l'en-tête sur chaque appel, flux compris.

Le board **refuse de démarrer** si `.forge-token` existe mais est vide, tronqué ou illisible : pas de repli silencieux sans jeton.

**Aucune route n'est ouverte sans secret**, l'entrée des hooks comprise. Reste que le hook Claude Code ne sait rien porter d'autre qu'une URL. Plutôt que d'y mettre le jeton du board, `POST /api/hooks` a **son propre secret**, dérivé du jeton par HMAC-SHA256 : il n'ouvre que l'entrée des hooks, il ne permet ni de lire le board ni de lancer une session, et il ne révèle pas le jeton dont il vient. Une fuite dans un journal ne coûte alors qu'un enregistrement de fichier touché.

Sa configuration ne peut donc pas être versionnée. Elle vit dans `.claude/settings.local.json`, gitignoré et en droits `600`, généré par :

```bash
npm run hook:install
```

`.claude/settings.json`, lui, reste versionné et ne contient plus que le garde-fou `PreToolUse`, qui n'a besoin d'aucun secret. Les hooks étant lus au démarrage de la session, il faut redémarrer Claude Code après l'installation.

Les chemins de preuve sont confinés : `evidencePath` doit vivre sous `.claude/evidence/`, sans `..`, sans chemin absolu, sans antislash, sans octet nul. Un `../../../.ssh/id_rsa` part en `409`.

Le hook `PostToolUse` sur `Edit|Write|NotebookEdit` est de type `http` et poste sur `POST /api/hooks`. Les hooks sont lus au démarrage de la session : modifier `.claude/settings.json` n'a d'effet qu'à la session suivante.

## 8. Installation et usage

### Prérequis

- Node.js 22+
- Claude Code ≥ 2.1.224 pour la communication inter-sessions

```bash
npm install
npm run forge
```

| Commande | Effet |
|---|---|
| `npm run forge` | Démarre le board (schéma appliqué au démarrage) |
| `npm run hook:install` | Écrit le hook avec son jeton dans `.claude/settings.local.json` |
| `npm test` | Suite complète (vitest) |
| `npm run build` | Compile le TypeScript |

| Variable | Défaut |
|---|---|
| `FORGE_PORT` | `8830` |
| `FORGE_DB_PATH` | `forge.db` |
| `CLAUDE_CONFIG_DIR` | `~/.claude` |
| `FORGE_SESSION_CAP` | `3` |
| `FORGE_HOST` | `127.0.0.1` |

## 9. Structure

Un dossier par côté, OSDD dans chacun : `technical/` ne dépend jamais de `domain/`. Le hub, quand il viendra, sera un mode de `backend/`, pas un troisième dossier.

```
db/forge.sql                          schéma SQLite (WAL)

backend/src/forge.ts                  entrypoint
backend/src/domain/Story/             story, jumelle, dépendances, backlog
backend/src/domain/Checkpoint/        les six étapes et leurs preuves
backend/src/domain/Criterion/         critères d'acceptation, porte de merge
backend/src/domain/Agent/             sessions d'agents, fichiers touchés, conflits
backend/src/domain/Zone/              zones de fichiers et rattachement des chemins
backend/src/domain/Dispatch/          contrat des phases, plafond, lancement
backend/src/domain/Board/             l'API HTTP du board
backend/src/domain/Budget/            plafond de coût et conduite à tenir
backend/src/domain/Foremerge/         réservation de périmètre et collisions
backend/src/domain/Identity/          comptes, sessions, mode hub
backend/src/domain/Incident/          sources et signalements du dehors
backend/src/domain/Statistic/         historique des sessions et totaux
backend/src/domain/Tamper/            recensement des tests avant la review
backend/src/technical/Database/       connexion SQLite
backend/src/technical/Http/           serveur, bus d'événements, flux SSE
backend/src/technical/Guardrail/      liste de deny, décision, hook PreToolUse
backend/src/technical/ClaudeCode/     roster, jobs, lanceur de session (Agent SDK)
backend/src/technical/Network/        port et sous-domaine déterministes
backend/tests/                        miroir de backend/src/

frontend/index.html                   hôte de la SPA
frontend/src/technical/Api/           client du board, flux d'événements
frontend/src/technical/Router/        les neuf écrans du pipeline
frontend/src/technical/Theme/         jetons de design, thèmes, contraste
frontend/src/technical/Ui/            états d'écran partagés
frontend/src/domain/Shell/            coque, rail de navigation, agents actifs
frontend/src/domain/<Ecran>/          un dossier par écran
frontend/tests/                       miroir de frontend/src/

.claude/commands/                     la séquence /SPEC … /SHIP
.claude/skills/                       méthodologie embarquée
.claude-deny.json                     commandes jamais exécutées
```

## 10. Stack

- **Back** : TypeScript sur Node + Hono, `better-sqlite3`, `zod`, vitest
- **Front** : Vue 3 + TypeScript + Vite, SPA pure — pas de Nuxt, pas de SSR — `vue-router`, Pinia pour l'état seulement, shadcn-vue + Tailwind
- Un process en production (le serveur sert `dist/`), deux en développement (`vite dev` proxifie `/api`)

L'orchestration bas niveau ne se réécrit pas : elle s'appuie sur le premier parti — le daemon `claude agents`, l'isolation par worktree et les hooks — plutôt que sur un pilotage par scraping de terminal.

## 11. État d'implémentation

| Brique | Statut |
|---|---|
| Schéma et connexion SQLite | Fait |
| Story, jumelle, dépendances, backlog | Fait |
| Six checkpoints prouvés par fichier | Fait |
| Critères d'acceptation bloquant le merge, prouvés par fichier | Fait |
| Ticket en deux volets sur une seule route | Fait |
| Cascade de review et findings | Fait, côté domaine |
| Sessions d'agents et conflits de fichiers | Fait |
| API du board et intake des hooks | Fait |
| Garde-fou deny (fail closed) | Fait, hook branché |
| Port et sous-domaine déterministes | Fait |
| Doctrine `/SPEC … /SHIP` alignée sur l'API | Fait |
| États kanban, points, rollout, conflit de merge | Fait |
| Cascade de review par lentille, ordonnée et bloquante | Fait |
| Zones de fichiers avec résumé et rattachement des chemins | Fait |
| Jetons de design lisibles (6 thèmes, clair et sombre) | Fait |
| Dispatch d'une session par story (Agent SDK) | Fait |
| SSE vers le board | Fait |
| Réservation de périmètre refusée à l'écriture et au lancement | Fait |
| Comptes, sessions et mode hub | Fait |
| Signalements venus du dehors, tranchés par un humain | Fait |
| Plafond de coût qui coupe, conduite au choix | Fait |
| Historique des sessions et statistiques | Fait, lues depuis la base du board |
| Front : routeur, coque et les neuf écrans du pipeline | Fait |
| Cycle de vie des worktrees et réservations de port | À faire — s'appuie sur le daemon, pas de plomberie propre |
| Métriques machine fines | À consommer depuis OpenTelemetry, pas à collecter |
| Feature flags | À déléguer à OpenFeature, le board ne garde que le pourcentage |
| Pilotage navigateur de l'étape 6 (ralenti, pause, inspection) | À faire — Playwright MCP et le Browser pane |

Le relevé de l'outillage existant étape par étape est dans [docs/Tooling.md](docs/Tooling.md), et le listing exhaustif du paysage — environ 120 projets, licences et mécanismes — dans [docs/Landscape.md](docs/Landscape.md).
