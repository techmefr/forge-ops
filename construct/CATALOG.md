# construct — catalogue des briques & backlog de sourcing

> **construct = superpowers, version Xefi, qu'on maîtrise.** Un framework *à nous*, enrichi en
> continu en **réécrivant** (règle B, `CONVENTIONS.md`) les meilleures idées/agents d'autres
> repos — jamais en dépendant d'eux. Ce fichier tient : **1)** ce qu'on a, **2)** ce qu'on peut
> réécrire pour compléter/améliorer. Vivant : on l'étend au fil de l'eau.
> Statuts : ✅ réécrit chez nous / 🟡 écrit, pas encore dogfoodé / 🔜 à câbler / 🔎 à miner / ✕ écarté.

## 1. Registre des briques

### Skills — le pipeline (`WORKFLOW.md` §2)
| Brique | Étape / couche | Origine (idée réécrite) | Maturité |
|---|---|---|---|
| start-feature | 0 — worktree | interne starfleet + obra `using-git-worktrees` | 🟡 |
| brainstorm | 1 | natif `brainstorming` | 🟡 |
| spec | 2 | mattpocock `grill-with-docs` + interne | 🟡 |
| archi | 3 | interne graphify (+ dédup à construire) | 🔜 |
| plan | 4 | addyosmani `planning-and-task-breakdown` | 🟡 |
| tdd | 5 | Xefi `test-casebook` + cwc `default-FAIL contract` | 🟡 |
| code | 6 | natif + interne | 🟡 |
| debug | support 6 | natif `systematic-debugging` | 🟡 |
| extract-conventions | setup/maintenance | graphify + mattpocock/addyosmani | 🟡 (génère les références depuis le code réel) |
| portless-ready | setup/infra | outil `vercel-labs/portless` (câblage à nous) | 🟡 (rend une stack portless : alias HTTPS + hygiène ports) |
| **gate** | 7 | **cwc** `default-FAIL hook` + `fresh-context evaluator` | 🔜 (câblage) |
| review | 8 | mattpocock `code-review 2 axes` + agents Xefi + natif | 🟡 |
| simplify | 9 | natif `simplify` | 🟡 |
| ship | 10 | interne (`/SHIP`, gandalf) | 🟡 |
| finish | 11 | interne (`finish_task`) | 🟡 |

### Agents métier (invoqués par les étapes 8/10)
| Agent | Rôle | Maturité |
|---|---|---|
| bobby / bobby-react | review MR voix Xefi (Nuxt/Vue · React) | ✅ |
| valerianus | tri/reformulation des reviews (anti-débat) | ✅ |
| gandalf | gate final MR (`/code-review` + `/security-review`) | ✅ |
| tuteur-laravel | pédagogie (hors pipeline) | ✅ |
| **évaluateur** (GATE) | juge à contexte propre, **sans Write/Edit**, rend PASS/NEEDS_WORK | 🔜 à créer |

## 2. Backlog de sourcing — idées/agents à réécrire pour compléter/améliorer

Repos vérifiés (veille 2026-07, cf. `VEILLE.md`). Chaque ligne = une idée à **réécrire chez
nous**, pas à installer.

| Source | Idée / agent à reprendre | Enrichit | Statut |
|---|---|---|---|
| cwc-long-running-agents | default-FAIL hook + evaluator | gate | ✅ (reste le câblage) |
| mattpocock/skills | grill-with-docs → CONTEXT.md+ADR | spec | ✅ |
| mattpocock/skills | code-review 2 axes non-polluants | review | ✅ |
| mattpocock/skills | `wayfinder`, `handoff`, `improve-codebase-architecture`, `domain-modeling` | archi / reprise de session | 🔎 |
| addyosmani/agent-skills | `security-and-hardening`, `observability`, `api-and-interface-design`, `webperf`, `context-engineering` | nouvelles briques | 🔎 |
| addyosmani/agent-skills | `browser-testing-with-devtools` | gate (recoupe `verify-flow`) | 🔎 |
| superpowers (obra) | `dispatching-parallel-agents`, `subagent-driven-development`, `writing-plans` | plan / orchestration | 🔎 (déjà en skills natifs → à *posséder*) |
| wshobson/agents | `git-advanced-workflows` (worktrees avancés) | start-feature / finish | 🔎 (réf citée, à vérifier) |
| herdr | état live depuis le réel + socket-API | FLEET | 🔎 (après dogfood) |
| mindwalk | replay/audit post-hoc | FLEET / graphify | 🔎 (nice-to-have) |
| headroom | compression + mesure tokens par appel | Taskling | 🔎 (réécrire vs consommer natif — à trancher) |
| smixs/agent-second-brain | pipeline voix→vault | Lumia | 🔎 (réf, réécrire avec classifieur read-only) |
| agency-swarm | org-chart coordinateur+agents | dispatch multi-agents | 🔎 (réf archi seulement) |
| cwc | kill-switch / steer (hooks opérateur) | — | ✕ (humain présent) |
| Caveman | compression de sortie | Taskling | ✕ (gain net faible + style télégraphique) |
| LobeHub / OpenHands | autonomie 24/7 / bout-en-bout | — | ✕ (repoussoir : no-auto-merge) |

## 3. La règle qui fait qu'on « maîtrise » (rappel)

On ne branche jamais un repo en dépendance. On lit → on extrait le mécanisme → on **réécrit**
dans le gabarit unique → on crédite `Origine`. Voir la checklist d'adoption dans
`CONVENTIONS.md`. C'est ce qui garantit : personne en amont ne casse notre workflow, et tout
est écrit pareil (maintenable). Le backlog ci-dessus est notre file d'enrichissement — on y
pioche quand une étape a un vrai manque, pas pour empiler.
