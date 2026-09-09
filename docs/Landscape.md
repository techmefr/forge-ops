# Listing du paysage — fonctionnalités, pas code

Relevé du 2026-09-09. Six passes de lecture parallèles sur les catégories de [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators), plus les concurrents directs hors liste. Environ 120 projets lus par leur README, page produit et fichier `LICENSE` — jamais par leur code. La catégorie « Personal Assistants » est écartée : elle ne touche aucune des neuf étapes.

Les neuf étapes servent de grille : **1** écriture story + jumelle · **2** backlog et envoi groupé · **3** plan d'architecture validé par un humain · **4** kanban avec dépendances bloquantes · **5** vue fichiers par zones et collisions · **6** test navigateur piloté + review en cascade · **7** branche par story, file de merge, feature flags · **8** ressources et coût · **9** statistiques de sessions.

---

## 1. Licences — à trancher avant toute dépendance

Un tiers du paysage porte une licence qui interdit le produit concurrent. Ces projets restent lisibles pour leurs idées ; leur **code** est hors de portée si starfleet est vendu un jour.

| Projet | Licence | Effet |
|---|---|---|
| `amux` | MIT + **Commons Clause** | revente commerciale interdite |
| `AgentsMesh` | **BSL-1.1** → GPL-2.0+ le 2030-02-28 | usage commercial en prod payant avant cette date |
| `loki-mode` | **BSL-1.1** → Apache-2.0 le 2030-03-19 | idem |
| `Ivy-Tendril`, `collaborator`, `supacode` | **FSL-1.1-ALv2** | usage concurrent interdit 2 ans |
| `GraphCode` | **FSL-1.1-MIT** | idem |
| `agent-kanban`, `NXTG-Forge Orchestrator` | **FSL-1.1** | idem |
| `superset` | **Elastic License 2.0** | service hébergé interdit |
| `multica` | **licence maison** (Apache + clauses) | toute instance exposée à des tiers interdite, même gratuite |
| `Claude Command Center` | **propriétaire** depuis le 2026-07-28 | MIT seulement avant cette date |
| `Better Agent` | source-available non commercial | autorisation écrite requise |
| `constellagent`, `orc`, `handoff` | **aucun fichier LICENSE** | tous droits réservés par défaut |

Copyleft fort, à surveiller sans être bloquant tant qu'on n'emprunte pas de code : `claude-squad`, `openkanban`, `Ouijit`, `Proliferate`, `kandev`, `coder/mux`, `Fletch`, `Alethe`, `Aperant`, `Agent Teams`, `claude_codex_bridge`, `tlbx` (AGPL-3.0) ; `cmux`, `aizen`, `Garcon` (GPL-3.0, `cmux` propose explicitement des termes commerciaux séparés) ; `egoist/waku` (GPL-3.0).

Sans risque et directement montables : `Concord MCP`, `guild`, `foremerge`, `Open Multi-Agent`, `aGiTrack`, `Archon`, `Crewplane`, `gastown`, `hcom`, `ORCH`, `paperclip`, `no_human`, `NEEDLE`, `sortie`, `symphony`, `Fusion`, `Vibe Kanban`, `claude-code-kanban`, `kanban-code`.

---

## 2. Ce que personne ne couvre

Sur ~120 projets lus, **aucun** ne fait :

- **Étape 1** — une story écrite avec sa **jumelle de test** en même temps. Le plus proche est `LoopTroop` (un conseil de LLM interviewe l'humain pour lever les ambiguïtés puis génère un PRD et des unités atomiques) et `Ivy-Tendril` (annotations inline sur un brouillon de plan qui mettent à jour les objectifs de l'agent). Personne ne jumelle fonctionnel et test.
- **Étape 5, la vue** — partout l'isolation par worktree *tient lieu* de vue fichiers. Aucun projet n'affiche une architecture émergente par zones nommées avec résumé.
- **Étape 6, la cascade nommée** — personne ne fait qualité → sécurité → **accessibilité**. L'accessibilité n'apparaît nulle part comme lentille de review.
- **Étape 7, les feature flags** — aucun projet ne gère un rollout progressif. Ni file de merge chez presque tous.
- **La DoD prouvée par fichier** — des gates de vérification existent partout, des `evidence_path` obligatoires nulle part.

C'est le périmètre à construire, et il est plus étroit et plus net qu'avant ce relevé.

---

## 3. Ce que le paysage fait mieux que nous

### Étape 5 — collisions : cinq mécanismes, du plus faible au plus fort

1. `hcom` (MIT) — **notifie** quand deux agents éditent le même fichier dans une fenêtre de 30 secondes. C'est notre niveau actuel : constat après coup.
2. `ORCH` (MIT) — **détection de chevauchement de scope avant** la collision de fichiers. Préventif.
3. `Concord MCP` (MIT) — **baux de réservation** avec détection de chevauchement au moment du `start_work`, journal d'ownership append-only, et bundles de preuves de review.
4. `foremerge` (Apache-2.0) — réservation **sémantique** : la cible n'est pas un chemin mais un `KIND:KEY=OPERATION` sur 12 genres (`symbol`, `api`, `schema`, `config`, `infra`, `test`, `migration`, `env`, `file`, `component`, `contract`, `domain`). Conflits détectés de façon déterministe avec sévérité, jamais par jugement de modèle.
5. `NXTG-Forge Orchestrator` (FSL, bloqué) — **verrous exclusifs** de fichier entre Claude Code, Codex et Gemini CLI sur un même repo, testés contre 378 scénarios de concurrence.
6. `Zaivern Code` (Apache-2.0) — **ownership de plages de lignes** appliqué à l'écriture, plus fin que le verrou de fichier.

**Verdict.** Notre `path_claim` par préfixe se situe au niveau 2-3. `foremerge` est un cran au-dessus et se monte **sous** le board sans lui prendre la source de vérité : son store est un SQLite dans le `git-common-dir`, ses 18 opérations sont exposées en MCP stdio, et l'acceptation d'un changeset crée une ref git sans jamais merger. À laisser sans connecteur cloud.

### Étape 8 — coût et ressources : déjà résolu, plusieurs fois

- Claude Code émet **nativement** coût, jetons et appels d'outils par session en OpenTelemetry.
- `repomon` (Apache-2.0) — calcule le coût **directement depuis les transcripts locaux**, sans API de facturation. Ledger par modèle et par repo.
- `aGiTrack` (Apache-2.0) — inscrit prompt, modèle et coût-jetons **dans le message de commit**. Traçabilité sans base à part.
- `agent-deck` (MIT) — dashboard coût/jetons sur 15+ modèles avec **budgets** et export.
- `paperclip` (MIT) — **budget dur par agent qui coupe** au dépassement. Pas un affichage : une limite qui agit.
- `fractal` (Apache-2.0) — plafonds de coût USD à trois granularités (run / itération / étape) avec réserve de 10 %.
- `Agent Teams` (AGPL) — CPU/RAM **en plus** des jetons, par agent.

**Verdict.** Rien à collecter. On consomme, et on ajoute une seule chose que personne n'a chez nous : un plafond qui coupe.

### Étape 7 — file de merge

- `gastown` (MIT) — file façon **Bors avec bisection** pour isoler la MR fautive dans un lot. Le seul exemple sérieux du paysage.
- `dmux` (MIT) — **hooks de cycle de vie** création / pré-merge / post-merge, le point d'extension propre pour brancher une file et des flags.
- `Fusion` (MIT) — merge et actions destructives **toujours** soumis à confirmation humaine, y compris en mode autonome. Plancher non négociable.
- `symphony` (Apache-2.0, OpenAI) — **« proof of work »** : un paquet unique agrégeant statut CI, retours de review et analyses, présenté à l'humain avant merge.

**Verdict.** GitHub merge queue en natif, hooks pré/post-merge pour le reste, et la « proof of work » de symphony est exactement la forme que doit prendre notre écran de DoD avant `/SHIP`.

### Étape 6 — review

- `loki-mode` (BSL, bloqué) — **8 portes de qualité**, review à l'aveugle par 3 relecteurs indépendants avec sévérité bloquante, un « devil's advocate » anti-complaisance, détection de mocks factices, et des **« Evidence Receipts » qui séparent le fait déterministe du jugement IA**.
- `no_human` (MIT) — **tamper guard** : compte mécaniquement les tests supprimés, les skips ajoutés et les assertions tautologiques avant la porte de review. Et exige que les tests-preuve **échouent sur la base** et passent sur le nouvel arbre.
- `agent-kanban` (FSL, bloqué) — interdiction structurelle : **l'assigné ne peut pas approuver sa propre soumission**.
- `kodo` (MIT) — architecte et testeur doivent tous deux approuver, réassignation en boucle sinon.
- `ralphex` (MIT) — cascade en deux passes, 5 agents parallèles par axe (qualité, implémentation, tests, simplification, doc).
- `toryo` (MIT) — **quality ratcheting** : seuls les résultats notés ≥ 6,0 sont commités, le reste est annulé.
- `Claudexor` (MIT) — Best-of-N avec relecteurs indépendants, un seul patch gagnant appliqué.
- `cmux` (GPL) — **pane navigateur scriptable** (DOM, formulaires, éval JS) : le plus proche de notre test navigateur piloté.
- `agent-orchestrator` (Apache-2.0) — navigateur piloté par agent avec **profil isolé par worker**.
- `CompanyHelm` (MIT) — **vidéo de démo auto-générée attachée à la PR**.

**Verdict.** Trois choses à prendre : le tamper guard de `no_human` (mécanique, pas de jugement), la séparation fait/jugement de `loki-mode` dans le rapport à l'humain, et la règle « l'assigné n'approuve pas son travail ».

### Étape 4 — dépendances

- `guild` (Apache-2.0) — **déblocage en cascade** des tâches dépendantes dès qu'un bloqueur passe à `done`. Aussi chez `ClawTeam` (MIT).
- `agent-kanban` (FSL) — dépendances avec **rejet des cycles**.
- `bernstein` (Apache-2.0) — conditions de dépendance **déclaratives** (`condition: status == 'done'`).
- `ai-maestro` (MIT) — kanban avec suivi de dépendances explicite.
- `Fusion` (MIT) — kanban **plus graphe** de dépendances, worktree `fusion/{task-id}`.
- `Contrabass` (Apache-2.0) — gating `BlockedBy` et classification de progression en 5 étapes (Exploration → Editing → Testing → Reviewing → Wrapping) **dérivée de la vélocité des diffs**.

**Verdict.** Nous refusons `startBuilding` sur dépendance non résolue. Il manque le rejet des cycles et le déblocage en cascade — deux ajouts courts.

### Étapes 2 et 9 — intake et traçabilité

- `Claude Command Center` (propriétaire) — **files durables** vidées en parallèle par des workers, avec persistance des apprentissages.
- `NEEDLE` (MIT) — file SQLite avec **réclamation atomique**, et une machine à états où **chaque** code de sortie (succès, timeout, crash) a un handler explicite.
- `codecast` (MIT) — **`cast blame`** : remonter d'une ligne de code à la session et à l'agent qui l'a écrite.
- `Open Multi-Agent` (MIT) — **Run Viewer offline** rejouant timeline, dépendances, jetons et appels d'outils sans backend.
- `scion` (Apache-2.0, Google Cloud) — **télémétrie OTEL normalisée** entre harnais différents.
- `MartinLoop` (Apache-2.0) — **reçus d'exécution signés** localement et classification des échecs en 13 classes canoniques.
- `ralph-claude-code` (MIT) — **scoring de complétude** d'un ticket importé : sous 60/100, un plan est généré avant de lancer quoi que ce soit.

**Verdict.** `cast blame` est déjà chez nous sous une autre forme (`file_touch` → story). Le scoring de complétude est un filtre d'intake qu'on n'a pas, et la classification exhaustive des codes de sortie de `NEEDLE` est le bon modèle pour notre détection de boucle.

### Garde-fous anti-boucle

Peu de projets en ont de sérieux. Les meilleurs : `ralph-claude-code` (coupe après 3 boucles sans progrès ou 5 avec la même erreur, détection de stagnation par déclin du volume de sortie > 70 %), `Dex` (4 itérations sans changement du nombre de tâches restantes), `ralphex` (`--review-patience`), `Contrabass` (`stall_timeout_ms` + backoff plafonné), `Orkas` (4 garde-fous combinés : tours, outils, boucle, inactivité), `Loop Engineering` (**dégradation automatique de confiance** quand l'état persistant a plus de 30 jours), `background-agents` (auto-pause après 3 échecs).

---

## 4. Concurrents directs

| Projet | Licence | État | Ce qu'il a que nous n'avons pas |
|---|---|---|---|
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Apache-2.0 | **quasi gelé** — société fermée ~10 avril 2026, dernier push 2026-04-24 malgré la reprise communautaire annoncée | interface de test avec navigateur intégré et émulation d'appareil branchée sur le workspace de l'agent |
| [claude-code-kanban](https://github.com/NikiforovAll/claude-code-kanban) | MIT | actif | **fenêtre de contexte, jetons et coût affichés sur la carte kanban** |
| [kanban-code](https://github.com/langwatch/kanban-code) | Apache-2.0 | actif | fork/checkpoint de session, recherche BM25 dans l'historique |
| [openkanban](https://github.com/TechDufus/openkanban) | AGPL-3.0 | actif, jeune | kanban rendu dans le terminal |
| [Ouijit](https://github.com/ouijit/ouijit) | AGPL-3.0 | actif | **« Lenses »** : regrouper les changements par instruction nommée plutôt que par fichier |
| [Fusion](https://github.com/Runfusion/Fusion) | MIT | actif, hebdomadaire | **niveau d'oversight réglable** off / observe / steer / autonomous, avec plancher non négociable sur merge |
| [Aperant](https://github.com/AndyMik90/Aperant) | AGPL-3.0 | actif | prévention automatique de conflit entre 12 agents parallèles |
| [Fletch](https://github.com/fwdai/fletch) | AGPL-3.0 | bêta | **workflow déterministe plan→build→review→test avec conditions de complétion vérifiables** |

Le plus gros concurrent en notoriété est à l'arrêt. Les deux plus actifs conceptuellement proches, `claude-code-kanban` et `kanban-code`, sont permissifs et ne couvrent ni la story jumelle, ni la DoD prouvée, ni les dépendances.

**Collision de nom** : `jedarden/forge` s'appelle littéralement « FORGE: Federated Orchestration & Resource Generation Engine », et `nxtg-ai/forge-orchestrator` porte « Forge » aussi. Le nom n'est pas libre.

---

## 5. Ce qu'on monte, ce qu'on arrête, ce qu'on ajoute

**Monter sous le board, sans lui céder la source de vérité :**

- `foremerge` (Apache-2.0) — moteur de collision sémantique pour l'étape 5. Store SQLite local, 18 opérations MCP, connecteur cloud à laisser désactivé.
- OpenTelemetry de Claude Code — étapes 8 et 9. Rien à collecter.
- GitHub merge queue + hooks pré/post-merge façon `dmux` — étape 7.
- Playwright MCP et le Browser pane — le pilotage navigateur de l'étape 6.
- OpenFeature + Unleash ou Flagsmith — les feature flags. Le board ne garde que le pourcentage.

**Pièges à ne pas monter :** `Agentlas OS`, `omnigent`, `openfang`, `NemoClaw` sont des méta-harnais qui veulent posséder toute la boucle — les monter sous le board inverserait le rapport de force. `Concord MCP` a une télémétrie **opt-out**, pas opt-in : à désactiver explicitement si on l'embarque.

**Ajouts courts, tirés du relevé :**

1. Rejet des cycles de dépendance + déblocage en cascade (`guild`, `agent-kanban`).
2. Tamper guard avant la porte de review : tests supprimés, skips ajoutés, assertions tautologiques (`no_human`).
3. L'assigné n'approuve pas son propre travail (`agent-kanban`).
4. Plafond de coût qui coupe, pas qui affiche (`paperclip`, `fractal`).
5. Classification exhaustive des codes de sortie de session (`NEEDLE`).
6. Scoring de complétude d'une story avant lancement (`ralph-claude-code`).
7. Séparation fait déterministe / jugement IA dans le rapport à l'humain (`loki-mode`).
8. Jetons et coût affichés sur la carte kanban (`claude-code-kanban`).

**Ce qui reste à nous, confirmé par ~120 lectures :** la story et sa jumelle écrites ensemble, la definition of done prouvée par fichier, le kanban qui connaît ses dépendances, la vue fichiers par zones, et l'accessibilité comme lentille de review de plein droit.
