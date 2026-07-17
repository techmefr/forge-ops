# Présentation — starfleet & l'approche Xefi

> Notes pour présenter l'outil et l'approche. Angle : **l'orchestration + la méthode
> au-dessus du CLI**. Complémentaire au « tout CLI » du collègue, pas concurrent.
> Légende : ✅ fait / 🔜 vision-roadmap. Ne pas survendre le 🔜.

## Fil rouge (une phrase)
Le CLI (git worktree, docker, sail) **marche** — mais chaque dev rejoue les **mêmes
frictions à la main, à chaque fois**. starfleet + la méthode **enlèvent le juggling** et
**ajoutent la visibilité**. Le CLI est la fondation, starfleet la **tour de contrôle**.

---

## Slide 1 — Le problème (vécu, pas théorique)
Cas réel : sur `skera-front-web` + `skera-api` + `formation-laravel`, objectif *« voir la
page et se connecter »* → des heures de contournements.
- Collisions de **ports** hôte entre stacks.
- **URLs front↔back** désalignées, resync manuelle à chaque changement de port.
- **État non partagé** : conteneurs qui tombent, on ne sait plus quoi tourne.
- **Doublons** de worktree / code commun dupliqué.
- **RAM** : WSL ne voyait que **15 Go sur 32** (bridage par défaut) ; c'est **Elasticsearch
  dupliqué (1,5 Go ×N)** qui fait ramer — **pas les worktrees**.
- **Auth SSO** Microsoft non testable en local (callback cassé).

*(source : `FRICTIONS.md`, cas réels mesurés)*

## Slide 2 — Pourquoi le « tout CLI » ne suffit pas (respectueux)
- CLI = **fondation puissante** — à connaître.
- Mais : résolution **manuelle**, **répétée par chaque dev** ; **pas de source de vérité** ;
  **pas de vue d'ensemble** ; pas de coordination **multi-projet / multi-dev** ; l'auto-mode
  agent est **risqué**.
- Il manque **une couche au-dessus**. C'est là que starfleet arrive.

## Slide 3 — L'approche : 3 couches
- **construct** (méthode) 🔜 : brainstorm → spec → archi → plan → TDD → code → review → MR
  (IA + 2 humains) → merge → finish. *(réécriture Xefi de superpowers)*
- **starfleet** (orchestration/état) ✅ : worktrees, **ports déterministes uniques**,
  dashboard, tools MCP.
- **agents Xefi** (métier) ✅ : bobby / gandalf / valerianus, verify-flow, test-casebook,
  design system.
- **Le seam** : les skills **appellent les tools MCP starfleet** ; le **dashboard** montre
  l'état. Une logique, deux transports (MCP + HTTP).

## Slide 4 — Démo starfleet (live) ✅
- **Dashboard** : worktrees **groupées par projet** (chips couleur), **états expliqués au
  survol** (« escaladée = bloquée, besoin d'un humain »), **port déterministe unique**,
  indicateur **live/down**, bouton **Ouvrir**.
- **Onglet Architecture** : doc d'archi **vivant** (fichier / rôle / statut), se **remplit au
  merge**.
- **Actions** par worktree : créer / lancer / démarrer / arrêter / escalader / nettoyer /
  **finish** (post-merge : cleanup worktree + update develop).
- **Sidebar** = la roadmap visible (Cockpit, Pipeline, Revues, Agents, Ports, Activité — 🔜).

## Slide 5 — Ce que ça règle (mapping frictions → solution)
| Friction | Réglé par |
|---|---|
| Collisions de ports (#4) | ✅ clé (projet+branche) + unicité globale des ports |
| URLs désalignées (#5) | ✅ source de vérité unique / 🔜 domaines HTTPS fixes (portless) |
| Doublons de worktree | ✅ visibilité par projet / 🔜 identité de tâche + état équipe |
| RAM qui rame | ✅ start/stop (ne lancer que l'actif) + 🔜 infra partagée + débrider WSL (24 Go) |
| Auth SSO local | 🔜 URL HTTPS fixe donnée à Microsoft (Caddy/Traefik + mkcert) |

## Slide 6 — Vision / roadmap 🔜
- **Portless** : Caddy/Traefik + mkcert → **domaines HTTPS fixes** → URLs stables **et** SSO
  Microsoft fiable (une URI de redirection fixe).
- **graphify** : l'archi **réelle** (code existant) en face du **plan**.
- **dispatch multi-agents** : plusieurs agents en parallèle, chacun sa worktree isolée.
- **FLEET** : état **partagé équipe** (dédup, visibilité multi-devs).
- **construct → repo séparé** (Xefi superpowers).

## Slide 7 — Positionnement vs « tout CLI »
- **Pas opposés** : starfleet **pilote** le CLI (git/docker) et reste **dans Claude Code** (MCP).
- Le collègue montre le **« comment » bas niveau** (utile à maîtriser). Toi tu montres
  **« comment ça scale sans se réinventer à chaque fois » + la visibilité + la méthode**.
- Message de clôture (la punchline) :

> *« Le CLI est la fondation — indispensable. Mais à l'échelle de l'équipe, chacun rejoue les
> mêmes frictions à la main, sans visibilité. starfleet ne remplace pas le CLI : il le pilote,
> garde la source de vérité, et rend le tout visible et méthodique. Le CLI, c'est savoir
> conduire ; starfleet, c'est la tour de contrôle. »*

## Slide 8 — Libérer le potentiel de la machine (setup)
Message clé : *« ça rame à 3 worktrees » était un problème de **config**, pas de méthode ni
de machine.* Une i7-14700 / 32 Go encaisse plusieurs stacks — il faut juste **dé-brider** :
- **WSL débridé** : `.wslconfig memory=24GB` → Docker passe de **15 → 24 Go** (WSL prenait
  la moitié de la RAM par défaut).
- **Infra partagée** : **un seul** Elasticsearch + **un seul** MySQL pour tous les
  projets/worktrees (base par préfixe), et **par worktree seulement le conteneur app** — au
  lieu de dupliquer les 1,5 Go d'ES par stack.
- **start/stop** (starfleet) : ne faire tourner **que la worktree active**.
- **pnpm** : store partagé → pas de `node_modules` dupliqué entre worktrees.
- **Disque** (66 Go libres, tendu) : `docker system prune` + `finish_task` pour ne pas
  accumuler.

Conclusion à dire : *le matériel n'était pas la limite ; l'environnement était bridé. Une
fois débridé + l'infra mutualisée, le nombre de worktrees cesse d'être un souci.*

## Slide 9 — Adoption : le workflow d'abord, l'outil en option
Objection attendue : *« on ne va pas installer un truc de plus »*. Réponse en **deux tiers**.

- **Tier 1 — le workflow (tout le monde)** : des **skills** (des fichiers, dans le Claude Code
  déjà utilisé) qui encodent la méthode complète + les conventions Xefi, sur **git worktrees +
  le setup actuel**. **Rien à faire tourner.** Livre : discipline, cohérence, TDD, review, pipeline.
- **Tier 2 — l'outil (opt-in)** : starfleet (MCP + dashboard) ajoute ports déterministes, état,
  visibilité, actions. Pour qui veut la tour de contrôle.
- **Design clé — progressive enhancement** : les skills marchent **sans** starfleet ; **si** le
  MCP starfleet est présent, elles **utilisent ses tools** (create_task/launch…) → bonus
  coordination/visibilité. Un seul workflow, fonctionnel seul, meilleur avec l'outil.

Honnête : « reprendre ce qui existe » ≠ zéro install (les skills restent à ajouter), mais
**léger** (pas de service). Et le **Tier 1 seul ne règle pas** les ports coordonnés / la
visibilité partagée → ça, c'est le Tier 2.

> *« Le workflow, ce sont des skills dans le Claude Code que vous avez déjà — rien à installer
> ni à faire tourner. Le dashboard est un bonus optionnel pour qui veut la visibilité. Et le
> workflow marche seul ; il s'enrichit tout seul si l'outil est là. »*

---

## Annexe — chiffres / preuves à citer
- WSL **15 Go sur 32** (défaut) → `.wslconfig memory=24GB`.
- Conteneurs : ES **1,45 Go**, app skera **1,2 Go**, front **1,0 Go** → ce sont les services
  lourds dupliqués qui pèsent, pas les worktrees.
- Ports déterministes : deux branches `main` (stacktim / formation) → **deux ports distincts**.
- Qualité : **build vert + 26 tests**, dashboard vérifié.

## Démo — checklist live (2 min)
1. `http://localhost:4998` — dashboard sombre, groupes par projet, chips couleur.
2. Survoler un statut **escaladée** → l'explication + la raison.
3. Survoler un bouton d'action → tooltip détaillé (commande, port).
4. Onglet **Architecture** → fichiers + statuts (en attente / en cours / fini).
5. Réglages (engrenage) → langue / taille texte / thème ; réduire la fenêtre → **cards**.
6. (si prêt) `create_task` → `launch_worktree` → la worktree apparaît, port unique, **Ouvrir**.
