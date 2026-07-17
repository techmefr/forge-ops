# construct — la couche méthode (Xefi superpowers)

> *« I know kung fu. »* Dans Matrix, **le Construct** est le programme où l'on charge
> des capacités. Ici c'est pareil : le dossier des **skills** qui encodent notre
> façon de travailler chez Xefi.

## Positionnement (trois couches)

- **construct** (ce dossier) = la **méthode** : *comment* le travail coule. Réécriture
  à notre voix de [superpowers](https://github.com/obra/superpowers) + notre couche Xefi.
- **starfleet** (le repo autour) = l'**orchestration/état** : *où* ça tourne (worktrees,
  ports déterministes, dashboard, tools MCP).
- **agents Xefi** (bobby / gandalf / valerianus, verify-flow, security-review, test-casebook,
  design system) = la **couche métier**, branchée dans les slots review/verify.

> **Temporaire ici pour tester « le tout ».** À terme, `construct/` sortira en repo
> séparé (cf. la vision « on divisera »). Pour l'instant on l'éprouve au sein de starfleet.

## Le pipeline (notre vision)

```
tâche → brainstorm → spec → archi → plan → TDD (test-casebook) → code
      → review (bobby/valerianus) → analyses + MR (gandalf + IA)
      → 2 approbations humaines → merge → finish (nettoie worktree + update develop)
```

## Le seam avec starfleet (ce qui relie méthode et orchestration)

Les skills **appellent les tools MCP de starfleet** aux moments clés, et le **dashboard**
visualise l'état :

| Étape construct | Tool starfleet appelé |
|---|---|
| démarrer une feature | `create_task`, `launch_worktree`, `start_server` |
| chaque checkpoint | `update_checkpoint` |
| archi validée | `set_arch_node` |
| bloqué | `escalate` |
| post-merge | `finish_task` (cleanup + update develop) |

## Skills (réécriture de superpowers + Xefi)

À réécrire à notre voix (14 skills superpowers en source) :

| construct | source superpowers | couche Xefi ajoutée |
|---|---|---|
| `using-construct` | using-superpowers | discipline + pipeline + seam starfleet |
| `start-feature` | using-git-worktrees | crée la worktree via starfleet (create_task/launch) |
| `brainstorming` | brainstorming | — |
| `spec` | (spec-clarification) | conventions Xefi |
| `plan` | writing-plans / executing-plans | — |
| `tdd` | test-driven-development | **doctrine test-casebook** |
| `debugging` | systematic-debugging | — |
| `verify` | verification-before-completion | **verify-flow** (drive réel de l'app) |
| `request-review` / `receive-review` | requesting/receiving-code-review | **bobby / valerianus / gandalf** |
| `finish` | finishing-a-development-branch | **`finish_task` starfleet** |
| `dispatch-parallel` | dispatching-parallel-agents + subagent-driven-development | worktrees isolées starfleet |
| `writing-skills` | writing-skills | — |

**État : démonstrateur.** Seules `using-construct` et `start-feature` sont écrites pour
prouver le seam ; le reste suivra skill par skill.
