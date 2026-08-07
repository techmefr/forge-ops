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
| vue-nuxt-vuetify-conventions | 6 | antfu/skills `vue` + affaan-m `nuxt4-patterns` + onmax/nuxt-skills + cylixlee/skills `vuetify-4` + geoql/doctor (correctness/sécurité) + metabase/metabase `typescript-review` (a11y/bundle) + retours de review internes Xefi dénominalisés (patterns récurrents) | 🟡 |
| react-nextjs-conventions | 6 | vercel-labs/agent-skills `react-best-practices` + Mindrally/skills `redux-toolkit` + velcrafting/codex-skills `shadcn` + millionco/react-doctor (section correctness/sécurité) + metabase/metabase `typescript-review` (a11y/bundle) | 🟡 (écrit, pas encore dogfoodé) |
| over-engineering-review | 9 | DietrichGebert/ponytail `ponytail-review`/`ponytail-audit` (angle suppression, tags, score net de lignes) | 🟡 |
| nestjs-node-conventions | 6 | Jeffallan/claude-skills `nestjs-expert` + SpillwaveSolutions/mastering-typescript-skill + Mindrally/skills `prisma-development`/`trpc`/`zod-schema-validation` | 🟡 (écrit, pas encore dogfoodé ; première brique construct back Node) |
| debug | support 6 | natif `systematic-debugging` | 🟡 |
| extract-conventions | setup/maintenance | graphify + mattpocock/addyosmani | 🟡 (génère les références depuis le code réel) |
| portless-ready | setup/infra | outil `vercel-labs/portless` (câblage à nous) | 🟡 (rend une stack portless : alias HTTPS + hygiène ports) |
| **gate** | 7 | **cwc** `default-FAIL hook` + `fresh-context evaluator` | 🟡 (agent `arbitre` écrit ; hook default-FAIL par repo reste à poser) |
| review | 8 | mattpocock `code-review 2 axes` + agents Xefi + natif | 🟡 |
| simplify | 9 | natif `simplify` | 🟡 |
| ship | 10 | interne (`/SHIP`, gandalf) | 🟡 |
| finish | 11 | interne (`finish_task`) | 🟡 |
| merge-worktree | 11 | neolabhq/context-engineering-kit `git-worktrees` | 🟡 |

### Agents métier (invoqués par les étapes 8/10)
| Agent | Rôle | Maturité |
|---|---|---|
| aragorn / gimli / legolas | review MR voix Xefi (Nuxt/Vue · React) | ✅ |
| valerianus | tri/reformulation des reviews (anti-débat) | ✅ |
| gandalf | gate final MR (`/code-review` + `/security-review`) | ✅ |
| tuteur-laravel | pédagogie (hors pipeline) | ✅ |
| **arbitre** (GATE, ex-« évaluateur ») | juge à contexte propre, **sans Write/Edit**, rend PASS/NEEDS_WORK avec preuve citée | ✅ (écrit ; hook default-FAIL par repo pas encore posé, pas encore dogfoodé) |
| vue-nuxt-builder | implémentation Vue3/Nuxt3 (Composition API, réactivité, perf) sur functional/ | ✅ (pas encore dogfoodé) |
| sql-es-tuner | tuning SQL (MySQL/SQL Server) et mapping/indexation Elasticsearch-Scout | ✅ (pas encore dogfoodé) |
| laravel-builder | implémentation Laravel/Eloquent (API, queues, perf), distinct de tuteur-laravel | ✅ (pas encore dogfoodé) |

## 2. Backlog de sourcing — idées/agents à réécrire pour compléter/améliorer

Repos vérifiés (veille 2026-07, cf. `VEILLE.md`). Chaque ligne = une idée à **réécrire chez
nous**, pas à installer.

| Source | Idée / agent à reprendre | Enrichit | Statut |
|---|---|---|---|
| cwc-long-running-agents | `evaluator.md` (patron évaluateur contexte frais) → agent `arbitre` | gate | ✅ (agent écrit) |
| cwc-long-running-agents | `verify-gate.sh` (hook PreToolUse default-FAIL sur preuve lue) | gate | 🟡 (mécanisme identifié, câblage par repo restant) |
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
| antfu/skills | `skills/vue/` — script-setup-macros, core-new-apis, advanced-patterns | vue-nuxt-vuetify-conventions | ✅ |
| affaan-m/everything-claude-code | `skills/nuxt4-patterns/SKILL.md` | vue-nuxt-vuetify-conventions | ✅ |
| onmax/nuxt-skills | `skills/nuxt/references/nuxt-composables.md` (discipline useState/useCookie/useRequestFetch, extrait limité) | vue-nuxt-vuetify-conventions | ✅ |
| cylixlee/skills | `.deprecated/vuetify-4/SKILL.md` + `references/patterns/` | vue-nuxt-vuetify-conventions | ✅ |
| neolabhq/context-engineering-kit | `plugins/git/skills/git-worktrees/SKILL.md` — section "How to Merge Worktree" | merge-worktree | ✅ |
| rshah515/claude-code-subagents | `vue-expert` (frameworks) → agent `vue-nuxt-builder` | agents métier (build front) | ✅ |
| wshobson/agents | absence confirmée d'agent Vue/Nuxt (grep sur 203 agents) → confirme le manque comblé par `vue-nuxt-builder` | agents métier (build front) | ✅ (référence croisée) |
| VoltAgent/awesome-claude-code-subagents | `sql-pro` (02-language-specialists) → agent `sql-es-tuner` | agents métier (data) | ✅ |
| wshobson/agents | `sql-pro`, `database-optimizer` → agent `sql-es-tuner` | agents métier (data) | ✅ |
| rshah515/claude-code-subagents | `elasticsearch-expert` → agent `sql-es-tuner` | agents métier (data) | ✅ |
| VoltAgent/awesome-claude-code-subagents | `laravel-specialist` (02-language-specialists) → agent `laravel-builder` | agents métier (build back) | ✅ |
| wshobson/agents | `php-pro` (web-scripting), pas de spécialisation Laravel → confirme le manque comblé par `laravel-builder` | agents métier (build back) | ✅ (référence croisée) |
| cwc | kill-switch / steer (hooks opérateur) | — | ✕ (humain présent) |
| Caveman | compression de sortie | Taskling | ✕ (gain net faible + style télégraphique) |
| LobeHub / OpenHands | autonomie 24/7 / bout-en-bout | — | ✕ (repoussoir : no-auto-merge) |
| vercel-labs/json-render | `skills/vue/` — usage lib tierce de rendu JSON→Vue | vue-nuxt-vuetify-conventions | ✕ (pas une convention Vue générique, hors besoin Xefi) |
| onmax/nuxt-skills | `skills/nuxt-modules/` — auteuring de module Nuxt publié/npm | vue-nuxt-vuetify-conventions | ✕ (hors périmètre : g.compigni fait du code d'app, pas de module) |
| onmax/nuxt-skills | `skills/nuxt/SKILL.md` (dispatcher) | vue-nuxt-vuetify-conventions | ✕ (redondant avec le principe de progressive-disclosure déjà acquis dans using-construct) |
| sickn33/antigravity-awesome-skills | `using-git-worktrees` | merge-worktree | ✕ (redistribution telle quelle du skill obra déjà repris nativement et dans start-feature) |
| vuetifyjs/0 | lib headless (`@vuetify/v0`) | vue-nuxt-vuetify-conventions | ✕ (différente du Vuetify stylé Material utilisé sur skera-front-web) |
| harlan-zw/vue-ecosystem-skills | `vuetify-skilld` | vue-nuxt-vuetify-conventions | ✕ (dossier absent de l'arbre git actuel, contenu introuvable) |
| skilld-dev/vue-ecosystem-skills | `vuetify-skilld` | vue-nuxt-vuetify-conventions | ✕ (même repo/fork que harlan-zw, même dossier absent) |
| agents-inc/skills | `web-ui-vuetify` | vue-nuxt-vuetify-conventions | ✕ (fichier introuvable dans l'arbre actuel ; déjà couvert par les reviewers par stack en review) |
| dmitrypost/vuetifyskills | corpus de référence exhaustif (450 fichiers) | vue-nuxt-vuetify-conventions | ✕ (trop volumineux pour une brique condensée) |
| shelbeely/shelbeely-agent-skills | `material-design-3-guide` | vue-nuxt-vuetify-conventions | ✕ (guide MD3 générique multi-framework, hors sujet) |
| handbook.adra.dev | `frontend-best-practices` | vue-nuxt-vuetify-conventions | ✕ (contenu générique déjà connu, mieux couvert par design:*, inaccessible en réalité 403) |
| dedalus-erp-pas/foundation-skills | `frontend-design` | vue-nuxt-vuetify-conventions | ✕ (repo disparu 404, recoupe déjà le skill natif frontend-design) |
| levnikolaevich/claude-code-skills | `ln-114-frontend-docs-creator` | vue-nuxt-vuetify-conventions | ✕ (fichier absent, dépend d'un pipeline propriétaire non transposable) |
| thedotmack/claude-mem | `mem-search` | — | ✕ (sous-système complet, redondant avec le système de mémoire déjà en place) |
| thedotmack/claude-mem | `version-bump` (ex claude-code-plugin-release) | — | ✕ (script d'exploitation spécifique à claude-mem, pas une méthode généralisable) |
| safishamsi/graphify | `graphify` | — | ✕ (doublon confirmé du skill natif graphify déjà installé) |
| VoltAgent — mcp-developer | — | HeryJs (MCP) | ✕ (prématuré, pas de chantier MCP actif ; à ressortir en phase concrète de portage) |
| VoltAgent / rshah515 — api-documenter | — | — | ✕ (aucun signal de douleur doc API dans la mémoire) |
| VoltAgent — readme-generator | — | — | ✕ (recoupe déjà le changelog manuel test-casebook) |
| VoltAgent — dependency-manager | — | — | ✕ (aucun signal CVE/conflit de versions) |
| VoltAgent / wshobson — error-detective | — | — | ✕ (aucun incident concret au-delà des ports Docker, déjà traité) |
| VoltAgent — git-workflow-manager | — | — | ✕ (conventions déjà actées et stables : squash+delete, MR Draft, GCI naming) |
| VoltAgent — code-reviewer/security-auditor/penetration-tester/debugger/test-automator/qa-expert/accessibility-tester/refactoring-specialist | — | — | ✕ (déjà couverts par les reviewers par stack/gandalf/kobold + skills systematic-debugging/testing-doctrine-casebook/design:accessibility//simplify) |
| wshobson — legacy-modernizer | — | — | ✕ (aucune migration de framework en cours) |
| wshobson — typescript-pro | — | — | ✕ (signal générique et faible, aucune douleur TS documentée) |
| wshobson — database-architect | — | — | ✕ (pas de conception schéma from scratch ; couvert par `sql-es-tuner`) |
| wshobson — frontend-security-coder / backend-security-coder | — | — | ✕ (gandalf fait déjà tourner /security-review + délègue au reviewer de stack) |
| wshobson — devops-troubleshooter | — | — | ✕ (docker-proxy zombies déjà traité par fix documenté, pas un besoin d'agent) |
| wshobson — context-manager/team-lead/team-reviewer/team-implementer/team-debugger | — | dispatch multi-agents | ✕ (implémentation agency-swarm, archi à évaluer, pas un agent à écrire maintenant) |
| wshobson — plugin git-pr-workflows (code-reviewer) | — | — | ✕ (recoupe les reviewers par stack/gandalf) |
| wshobson — skill git-advanced-workflows | — | start-feature/finish | ✕ (cours de référence, pas un agent orchestré) |
| rshah515 — nestjs-expert / typescript-expert | — | HeryJs | ✕ (prématuré, à ressortir en phase active NestJS+TS) |
| rshah515 — react-expert | — | — | ✕ (utile pour lire le code des collègues React seulement, pas un besoin de prod g.compigni) |
| rshah515 — accessibility-expert / playwright-expert | — | — | ✕ (chevauchement design:accessibility + verify-flow) |
| rshah515 — architecture-documenter / contract-testing-expert / runbook-generator | — | — | ✕ (confiance faible, usage ponctuel, aucun signal récurrent) |
| rshah515 — core/code-reviewer, core/debugger, core/refactorer, core/architect, security-auditor, devsecops-engineer, ux-designer, ui-components-expert, code-documenter, orchestrators/*, postgresql-expert, redis-expert, graphql-expert, cypress-expert, jest-expert, e2e-testing-expert, operational/*, industry/* | — | — | ✕ (redondants avec le roster existant ou hors stack confirmée) |
| agency-swarm (VRSEN) | org-chart généraliste (qui parle à qui) | dispatch multi-agents | ✕ (aucun contexte frais forcé ni mécanisme de preuve/verdict ; hors sujet pour le manque GATE, reste piste archi 🔎 séparée) |
| vercel-labs/agent-skills | `react-best-practices` (AGENTS.md) — patterns perf/rendering/waterfalls avec code avant/après | react-nextjs-conventions | ✅ |
| Mindrally/skills | `redux-toolkit/SKILL.md` — createSlice typé, hooks typés, createAsyncThunk, sélecteurs mémoïsés | react-nextjs-conventions | ✅ |
| velcrafting/codex-skills | `skills/shadcn/SKILL.md` — composition par wrapper, cn(), structure de dossiers | react-nextjs-conventions | ✅ |
| millionco/react-doctor | `oxlint-plugin-react-doctor` — ~780 règles déterministes (state/effects, perf, sécurité, a11y), sous-ensemble sévérité `error` hors frameworks niches repris en section 4 | react-nextjs-conventions | ✅ (contenu réécrit ; l'outil lui-même reste un candidat 🔎 séparé pour un futur gate CI React — pas installé, aucun repo React à g.compigni) |
| geoql/doctor | `oxlint-plugin-vue-doctor`/`oxlint-plugin-nuxt-doctor` — verrouillé Vue 3 + Nuxt 4, explicitement inspiré de react-doctor ; règles réactivité/composition, hydratation SSR, sécurité, server routes h3 reprises en section 4 | vue-nuxt-vuetify-conventions | ✅ (contenu réécrit ; candidat 🔎 séparé pour un futur gate CI skera-front-web/nexeren-front-web, pas installé) |
| @healerlab/vue-doctor | alternative Vue-only trouvée en sourcing | vue-nuxt-vuetify-conventions | ✕ (pas de couverture Nuxt, geoql/doctor plus complet et plus proche de la stack réelle) |
| @framework-doctor/vue | alternative Vue trouvée en sourcing | vue-nuxt-vuetify-conventions | ✕ (moins mature/moins de règles que geoql/doctor à l'inspection) |
| DietrichGebert/ponytail | `ponytail-review`/`ponytail-audit` — angle suppression exclusif (dead code, stdlib réinventée, sur-abstraction, yagni), tags par catégorie, score net de lignes | over-engineering-review | ✅ (mécanisme et tags réécrits, nouvelle brique dédiée) |
| addyosmani/agent-skills | `code-review-and-quality` — 14.4K installs, taxonomie de sévérité Critical/Required/Nit/FYI, seuil de taille de diff, checklist dépendances | gandalf | ✅ (taxonomie + seuils intégrés en étape 1/5/7 de l'agent, pas une brique séparée) |
| metabase/metabase | `typescript-review` — blind-spots a11y (aria-label, focus modal) et poids bundle (import par défaut, module lourd en route) | react-nextjs-conventions + vue-nuxt-vuetify-conventions | ✅ (2 items ajoutés à chaque brique) |
| github/awesome-copilot | `review-and-refactor` — lit `.github/instructions/*.md`, refactore aux conventions du projet | — | ✕ (déjà couvert par les briques `*-conventions` + gandalf, rien de distinct) |
| metabase/metabase | `clojure-review` | — | ✕ (langage hors périmètre Xefi) |
| Cursor (cursor/plugins) | `thermo-nuclear-code-quality-review` | — | ✕ (même angle qu'over-engineering-review, moins actionnable — pas de tags/score) |
| cognitedata/builder-skills | `code-quality` | — | ✕ (spécifique à leur stack CDF/DI par contexte, reste déjà couvert par les reviewers par stack+conventions) |
| getsentry/warden | `architecture-review` | — | ✕ (chemin SKILL.md exact non confirmé ; contenu recoupe déjà gandalf/arbitre/over-engineering-review, pas assez différenciant) |
| Jeffallan/claude-skills | `skills/nestjs-expert/SKILL.md` — module/controller/service, DI constructeur, DTO+class-validator, exceptions HTTP, tests | nestjs-node-conventions | ✅ |
| SpillwaveSolutions/mastering-typescript-skill | contrats Zod+z.infer, unions discriminées, mapped types/type guards sur modèles Prisma | nestjs-node-conventions | ✅ |
| Mindrally/skills | `prisma-development/SKILL.md` + `trpc/SKILL.md` + `zod-schema-validation/SKILL.md` | nestjs-node-conventions | ✅ |
| vercel-labs/next-skills | `next-best-practices` | react-nextjs-conventions | ✕ (repo archivé, absorbé par Next.js lui-même — next dev 16.3+, rien de portable) |
| Mindrally/skills | `nextjs-react-typescript` | react-nextjs-conventions | ✕ (converti de Cursor rules génériques, redondant et moins précis que vercel-labs/agent-skills) |
| Mindrally/skills | `nextjs-react-redux-typescript-cursor-rules` | react-nextjs-conventions | ✕ (doublon quasi total de react + redux-toolkit réunis) |
| Mindrally/skills | `react` (générique) | react-nextjs-conventions | ✕ (conseils génériques senior dev, recoupe vercel-labs/agent-skills en moins riche) |
| Mindrally/skills | `express-typescript` | nestjs-node-conventions | ✕ (hors-cible : vision HeryJs est NestJS pas Express, recouvrement partiel sans plus-value) |
| Mindrally/skills | `nodejs-development` | nestjs-node-conventions | ✕ (fourre-tout incohérent — Payload CMS, Vue.js, générique) |
| Mindrally/skills | `typescript` (générique) | nestjs-node-conventions | ✕ (trop générique, déjà répété par nestjs-expert/trpc/zod) |
| josechifflet/shadcn-ui | shadcn-ui | react-nextjs-conventions | ✕ (repo introuvable/mort, seul un résumé tiers récupéré, pas la source elle-même) |
| mattbx/shadcn-skills | audit/discovery de composants shadcn existants | react-nextjs-conventions | ✕ (mécanisme différent, rôle reviewer plutôt que conventions de code ; piste séparée à garder) |

## 3. La règle qui fait qu'on « maîtrise » (rappel)

On ne branche jamais un repo en dépendance. On lit → on extrait le mécanisme → on **réécrit**
dans le gabarit unique → on crédite `Origine`. Voir la checklist d'adoption dans
`CONVENTIONS.md`. C'est ce qui garantit : personne en amont ne casse notre workflow, et tout
est écrit pareil (maintenable). Le backlog ci-dessus est notre file d'enrichissement — on y
pioche quand une étape a un vrai manque, pas pour empiler.
