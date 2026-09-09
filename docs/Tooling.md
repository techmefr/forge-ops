# Ce qui existe déjà, étape par étape

> Première passe. Le relevé exhaustif — environ 120 projets lus, licences vérifiées, mécanismes comparés — est dans [Landscape.md](Landscape.md), qui corrige et précise plusieurs conclusions ci-dessous.

Relevé du 2026-09-09. Question posée : pour chaque étape du pipeline, est-ce qu'un outil existant couvre le besoin mieux que du code écrit ici ?

Le paysage a explosé : la liste de référence `awesome-agent-orchestrators` recense plus de cent projets, répartis en agents parallèles (TUI et desktop), essaims multi-agents, boucles autonomes, runners déclenchés par ticket, et primitives d'infrastructure. La conséquence utile : **presque tout ce qui est plomberie est commoditisé, et presque rien ne couvre la story jumelée prouvée par fichier.**

## Verdict par étape

| Étape | Ce qui existe | Décision |
|---|---|---|
| 1. Écriture de la story | Rien. Les projets proches (`cyrus`, `Contrabass`, `Open Session`, `sortie`) **consomment** un ticket depuis Linear/GitHub/Slack, aucun ne l'écrit, et aucun ne connaît la jumelle de test | **Construire.** C'est le différenciateur |
| 2. Backlog et envoi groupé | Tous les boards le font, aucun ne porte la jumelle ni les dépendances | **Construire** (peu de code) |
| 3. Architecture à valider | Le motif est validé ailleurs : `Dex` (planification sous porte humaine, review multi-relecteurs), `Fusion` (portes plan → review → exécution), `AGX` (checkpoints avec porte humaine entre cycles), `Ivy-Tendril` (cycle de vie par plan avec portes de vérification) | **Construire**, garder `arch_done`. Ivy-Tendril est en **FSL-1.1** : à lire, pas à dépendre |
| 4. Kanban, worktrees, dépendances | Le segment le plus saturé : `Vibe Kanban` (Apache-2.0, 26,4k étoiles, **projet arrêté en avril 2026**, repris par la communauté), `claude-code-kanban`, `Kanban Code`, `nimbalyst`, `Ghostex`, `kandev`, `Ouijit`. Un worktree par tâche est un problème résolu | **Ne pas réécrire la plomberie worktree** : le daemon `claude agents` isole déjà sous `.claude/worktrees/`. Les **dépendances bloquantes entre cartes** ne sont couvertes par personne → construire |
| 5. Vue fichiers et collisions | La vraie trouvaille. `Concord MCP` (**MIT**) fait des baux de réservation, la détection de collision d'édition et le passage de preuves de review avant la PR. `foremerge` fait de la coordination git avec déclaration d'intention et de portée. `Fletch` et `Tempest` partagent un index de symboles. `Zaivern` fait de la propriété ligne à ligne | **Améliorer** : aujourd'hui la collision est *constatée* après coup via `PostToolUse`. Ajouter un `PreToolUse` qui **refuse** l'écriture hors du préfixe réservé par la story — la table `path_claim` existe déjà et n'est écrite par personne |
| 6. Test et review | Pilotage navigateur : Playwright MCP, le Browser pane, Claude in Chrome. Review en cascade : `loki-mode` (**BUSL-1.1**, review à trois relecteurs aveugles), `kodo` (vérificateur indépendant), `no_human` (**MIT**, review par un second modèle puis merge humain) | **Ne rien construire.** Piloter le navigateur avec l'outillage existant, et brancher les relecteurs mentis (qualité, sécurité, accessibilité) plutôt que d'écrire des relecteurs |
| 7. Déploiement | File de merge : **GitHub merge queue** en natif, ou `gastown` (file façon Bors). Feature flags : **OpenFeature** + Unleash ou Flagsmith. Conflits : `agent-orchestrator` répare CI et conflits, `Aperant` a une boucle QA auto-validante | **Adopter.** Ne jamais écrire de moteur de feature flags ni de file de merge. Le board garde seulement l'alerte sur la carte |
| 8. Ressources | Claude Code **émet déjà** coût et jetons par session en OpenTelemetry ; `~/.claude/jobs/<id>/state.json` porte `tokens`. `agent-squid` affiche une jauge de quota, `Claudexor` fait de la rotation selon le quota | **Consommer, pas collecter.** Nettoyage des conteneurs : `docker prune` derrière un hook de merge |
| 9. Statistiques | Entièrement couvert : Claude Code → OTLP → Prometheus/Grafana, ou CloudWatch Coding Agent Insights. `aGiTrack` inscrit le coût en jetons dans le message de commit, `codecast` enregistre les sessions avec attribution | **Ne pas construire de base de stats.** Le board interroge la source existante |

## Pièges de licence

Trois projets tentants interdisent le produit concurrent, ce qui les disqualifie comme dépendance si starfleet est vendu un jour :

- `amux` — MIT **+ Commons Clause** (revente commerciale interdite), et pilote les agents en grattant tmux
- `Ivy-Tendril` — **FSL-1.1**, source-available, bascule en Apache-2.0 après deux ans
- `loki-mode` — **BUSL-1.1**

Sans risque : `Concord MCP` (MIT), `Vibe Kanban` (Apache-2.0), `no_human` (MIT), `intentic` (MIT).

## Ce que ce relevé change

**Quatre choses à construire**, parce que personne ne les couvre : l'écriture de la story avec sa jumelle, la definition of done prouvée par fichier, le kanban qui connaît les dépendances bloquantes, et la vue fichiers par zones.

**Quatre choses à ne plus prévoir de construire** : la plomberie worktree (le daemon la fait), le pilotage navigateur (Playwright et le Browser pane le font), les feature flags (OpenFeature), et la télémétrie coût/durée/jetons (OTel en natif).

**Une amélioration nette** : passer de la détection de collision à la réservation de portée refusée à l'écriture.

## Sources

- [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)
- [Vibe Kanban](https://vibekanban.com/)
- [Concord AI](https://getconcord.ai/) et [concord-mcp](https://github.com/Get-Concord-AI/concord-mcp)
- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)
- [Claude Code + OpenTelemetry, coût et jetons par session](https://bindplane.com/blog/claude-code-opentelemetry-per-session-cost-and-token-tracking)
- [Analyzing Claude Code usage with CloudWatch and OpenTelemetry](https://aws.amazon.com/blogs/mt/analyzing-claude-code-usage-with-cloudwatch-and-opentelemetry/)
- [9 Open-Source Agent Orchestrators for AI Coding](https://www.augmentcode.com/tools/open-source-agent-orchestrators)
