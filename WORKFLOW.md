# Le workflow complet Xefi — puis son découpage en projets

> Démarche : **1)** décrire le workflow complet bout-en-bout (une seule chaîne, sans se
> soucier de « quel outil »), **2)** tracer les lignes de découpe en projets.
> Sources validées par la veille (2026-07) : natif Claude Code, `cwc-long-running-agents`
> (Anthropic), `mattpocock/skills`, `addyosmani/agent-skills`, `headroom`, patterns EIP/Anthropic
> Routing, Traefik interne (platform-stack/pilota). Détail comparatif : `VEILLE.md`.
> Légende : ✅ existe / 🟡 partiel / 🔜 à faire.

---

## 1. Vue d'ensemble

```
   INTAKE                 EXÉCUTION (pipeline gaté, 1 worktree = 1 feature)                 SORTIE
 ┌─────────┐   ┌──────────────────────────────────────────────────────────────────┐   ┌──────────┐
 │ Lumia   │→→ │ start → brainstorm → spec → archi → plan → tdd → code → GATE →     │→→ │ 2 appro. │
 │ (triage)│   │        review(2 axes + agents) → simplify → SHIP (MR draft)        │   │ humaines │
 └─────────┘   └──────────────────────────────────────────────────────────────────┘   │  → merge │
                                                                                        │ → finish │
   couches transverses (tout du long) :                                                 └──────────┘
   • ÉTAT/VISIBILITÉ : starfleet (local) → FLEET (équipe, live)
   • INFRA/PORTS     : Traefik portless (domaines fixes, zéro collision)
   • MÉTROLOGIE      : Taskling (tokens/coût par appel)
   • MÉTHODE         : construct (les skills qui encodent chaque étape)
   • AGENTS MÉTIER   : bobby / valerianus / gandalf, verify-flow, test-casebook, design system
```

**Principe directeur (fil rouge de la veille) :** *séparer construire et juger, avec un
évaluateur à contexte propre*, et le faire **avec le natif** (hooks, sous-agents) — sans
réintroduire d'auto-mode. C'est le renfort n°1 apporté à la séquence existante.

---

## 2. Le pipeline détaillé (l'« EXÉCUTION »)

Chaque étape écrit son **checkpoint** (source de vérité). Ce sont des garde-fous pour le dev,
pas un enchaînement automatique.

| # | Étape | Ce qui se passe | Checkpoint | Brique(s) | Origine | État |
|---|---|---|---|---|---|---|
| 0 | **start-feature** | worktree isolée + port/domaine attribué + tâche enregistrée | `created` | `create_task`+`launch_worktree`, Traefik | starfleet + infra | 🟡 |
| 1 | **brainstorm** | explorer l'intention avant tout code | — | skill `brainstorming` | natif/obra | ✅ |
| 2 | **spec** | verrouiller périmètre + hors-scope ; **interview → `CONTEXT.md` + ADR** | `spec_done` | `spec-clarification` + **grill-with-docs** | mattpocock | 🟡 |
| 3 | **archi** | *qu'est-ce qui existe déjà, où ça se branche* → **check anti-duplication** | `arch_done` | **graphify** (graphe + passe dédup) → `set_arch_node` | interne | 🔜 |
| 4 | **plan** | découpe en tâches atomiques | `plan_done` | `/PLAN`, `add_task_item` | addyosmani/interne | ✅ |
| 5 | **tdd** | tests d'abord ; **chaque critère = une ligne `{passes:false}`** | `tests_written` | doctrine **test-casebook** + **default-FAIL contract** | Xefi + cwc | 🟡 |
| 6 | **code** | construire par incréments | — | `/BUILD`, `systematic-debugging` | natif | ✅ |
| 7 | **GATE** | **verrou mécanique** : interdit de marquer `pass` sans preuve (screenshot/log) ; **évaluateur à contexte propre** (sous-agent sans Write/Edit) rend `PASS`/`NEEDS_WORK` | `verified` | **hook `PreToolUse` default-FAIL** + **fresh-context evaluator** + `verify-flow` | **cwc** + Xefi | 🔜 |
| 8 | **review** | 2 axes **parallèles non-polluants** — *Standards* (conventions + code-smells) & *Spec* (fidèle au ticket) ; puis agents Xefi | `reviewed` | **code-review 2 axes** + **bobby/valerianus** + `/code-review`+`/security-review` natifs | mattpocock + Xefi + natif | 🟡 |
| 9 | **simplify** | passe qualité (réutilisation, simplification) | `simplified` | `/CODE-SIMPLIFY` (skill `simplify`) | natif/interne | ✅ |
| 10 | **SHIP** | push + **MR en draft** ; l'agent **s'arrête ici** | `mr_draft_pushed` / `awaiting_human` | `/SHIP`, gandalf (gate final) | Xefi | ✅ |
| — | **2 approbations humaines → merge** | **hors périmètre agent** | — | humain | — | — |
| 11 | **finish** | arrêt serveur, retrait worktree, MAJ `develop` | (ligne supprimée) | `finish_task` | starfleet | ✅ |

**Règle d'or maintenue :** tests verts (prouvés, étape 7) avant `/SHIP`. La nouveauté vs
aujourd'hui : le « prouvés » devient **mécanique** (étape 7), plus un vœu.

---

## 3. Les couches transverses (présentes tout du long)

- **INTAKE — Lumia (triage).** En amont du pipeline : transforme une entrée brute (mail, voix,
  note) en **tâche classée** qui *entre* en étape 0. Design retenu : **classifieur read-only**
  (l'LLM ne rend qu'un label, du code déterministe route) + **cache par expéditeur** (« ne
  jamais reclasser deux fois le même émetteur »). Pattern validé (Content-Based Router EIP /
  workflow « Routing » Anthropic). 🔜
- **ÉTAT / VISIBILITÉ.** *starfleet* = source de vérité **locale** (SQLite, MCP + dashboard).
  *FLEET* = état **partagé équipe** + **live depuis le réel** (état des agents lu du réel, pas
  des déclarations — inspiration herdr). ✅ local / 🔜 équipe+live.
- **INFRA / PORTS.** *Traefik portless* : domaines fixes, zéro port hôte publié, zéro collision,
  URL stable (débloque aussi le SSO Microsoft). Déjà présent en interne (platform-stack, pilota)
  → **à généraliser** (cf. `CHALLENGE.md` reco B). Pour une URL *externe* (collègue/Microsoft) :
  tailscale/cloudflared, pas plug. 🟡
- **MÉTROLOGIE — Taskling.** Widget de suivi tokens/coût. Source de données : **headroom**
  (delta **par appel**, en CLI-wrap/proxy transparent, orthogonal à `/model`). Opt-in. 🔜
- **MÉTHODE — construct.** Les skills qui encodent chaque étape ci-dessus (marchent **sans**
  outil ; mieux **avec** starfleet — progressive enhancement). 🟡
- **AGENTS MÉTIER.** bobby/valerianus (review voix Xefi), gandalf (gate final), verify-flow,
  test-casebook, design system. ✅ existants, améliorés au fil de l'eau.

---

## 4. Le découpage en projets (le « après »)

Une fois le workflow posé, il se **tranche** en produits à périmètre net, avec des **tiers
d'adoption** (répond à l'objection « on ne va pas installer un truc de plus »).

| Projet | Possède dans le workflow | Dépend de | Tier | État |
|---|---|---|---|---|
| **construct** | étapes 1→10 (la méthode : skills + séquence + les 2 renforts cwc/mattpocock) | rien (Tier 1 autonome) | 1 — tout le monde | 🟡 |
| **starfleet** | étape 0 + 11 + checkpoints + état local + coordination ports | construct (consomme ses skills) | 2 — opt-in | ✅ socle / 🔜 mode Docker |
| **FLEET** | couche ÉTAT/VISIBILITÉ équipe + live | starfleet (consomme son état) | 3 — équipe | 🔜 |
| **Taskling** | couche MÉTROLOGIE (tokens) | headroom (externe) | opt-in | 🔜 |
| **Lumia** | couche INTAKE (triage/ingestion) | — (produit amont autonome) | à part | 🔜 |
| **infra portless** | couche INFRA/PORTS | Traefik (déjà là) | socle équipe | 🟡 |
| **agents Xefi** | renforts des étapes 5/7/8/10 | construct | fil de l'eau | ✅ |

**Règles de découpe (pour que ça tienne) :**
1. **Un projet = une responsabilité du workflow.** construct décide *quoi/comment* ;
   starfleet tient *où/état* ; FLEET rend *visible à l'équipe* ; Taskling *mesure* ; Lumia
   *fait entrer* ; l'infra *route*. Aucun ne réimplémente l'autre.
2. **Le natif Claude Code n'est jamais dupliqué** (`/model`, `/code-review`, hooks, mémoire).
3. **Chaque tier marche seul et s'enrichit si le suivant est présent** (progressive
   enhancement). Le workflow complet (construct seul) livre déjà la discipline ; starfleet
   ajoute l'état ; FLEET ajoute l'équipe.
4. **La frontière agent/humain est fixe** : l'agent s'arrête à la MR draft (étape 10).
   Les 2 approbations + le merge restent humains.

---

## 5. Ordre : tester l'approche complète, PUIS découper

Le découpage en projets (§4) est la **cible**, pas le point de départ. On valide d'abord le
pipeline entier sur une vraie feature (cf. `construct/CONVENTIONS.md` règle A). Chaque brique
reprise est **réécrite à notre sauce** (règle B), jamais une dépendance externe.

1. **Assembler le pipeline complet en interne** — consolider les briques éparses sous le
   gabarit unique + écrire les manques (brainstorm, archi, GATE default-FAIL+evaluator, grill→ADR,
   review 2 axes, contrat `{passes:false}`, finish). *Le plus gros levier, le moins de conflit.*
2. **Dogfood** — faire passer **une feature réelle** de start à SHIP, mesurer où ça tient / casse.
3. **starfleet** — mode Docker/stack (compose up/down par worktree) + ports au niveau
   `.env`/Traefik (aujourd'hui : spawn de process nu, cf. `CHALLENGE.md`).
4. **infra** — généraliser `docker-compose.traefik.yml` à skera/nexeren ; variabiliser l'ES
   hardcodé de nexeren-api.
5. **graphify** (étape 3) — passe de dédup cross-worktree (seul vrai morceau neuf).
6. **Découper en projets** (§4) une fois l'approche validée — FLEET / Taskling / Lumia ensuite.
