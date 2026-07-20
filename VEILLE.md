# Veille externe — confrontée à nos fichiers (2026-07)

> Chaque outil vérifié (existence + mécanismes réels, via ses sources). Verdict : recoupe /
> angle mort réel / à écarter. Alimente `WORKFLOW.md`.
> Note star counts : mattpocock et addyosmani ne sont **pas** gonflés — GitHub affiche même
> *plus* (~178k / ~79k) que les chiffres cités ; à footnoter « GitHub-reported, non corroboré ».
> cwc (officiel Anthropic) est modeste (~583★) : ce sont des primitives, pas un produit.

## Bucket STARFLEET / FLEET

| Outil | Recoupe | Angle mort qu'il comble | Verdict |
|---|---|---|---|
| **cwc-long-running-agents** (Anthropic) | séparation build/juge ≈ `/REVIEW`+`/code-review` | **default-FAIL** (hook `PreToolUse` : pas de `pass` sans preuve `Read`) + **fresh-context evaluator** (sous-agent sans Write/Edit) → verrou *mécanique* sur nos checkpoints déclaratifs (`README §4`), en primitives natives (`§2.4`) | **Intégrer #1.** Prendre les primitives, pas le wrapper « long-running non surveillé ». |
| **mattpocock/skills** | spec/tdd/review/handoff ≈ nos skills | **review 2 axes parallèles non-polluants** (Standards + **Spec/fidélité-ticket**, absent chez nous et de `/code-review`) ; **grill-with-docs → CONTEXT.md+ADR** ; conv. user- vs model-invoked | **Intégrer #2.** wayfinder + catalogue = picorer. |
| **addyosmani/agent-skills** | séquence **quasi identique** à `§5` (confirme la nôtre) | couverture : `security-hardening`, `browser-testing` (≈verify-flow), `observability`, `api-design`, `webperf` | **Picorer #3. Jamais `/build auto`** (= l'auto-mode retiré `§2.1`). |
| **herdr** (~12k★) | espace de **FLEET** (`§0`) | état **live depuis le réel** + socket-API où les agents se déclarent → vraie réponse à la désync `§1.2` (notre dashboard lit du déclaré) | **Plus tard, pour FLEET** (pas le socle). Emprunter l'idée, pas fusionner. |
| **mindwalk** | visualisation repo ≈ graphify | **audit/replay post-hoc** (on n'a aucun historique) — temporel vs structurel | **Nice-to-have**, tard. Replay-only, n'aide pas le live. |
| **LobeHub** / **OpenHands** | — | — | **Écarter (repoussoir pitch).** Autonomie-first vs notre no-auto (`§0`/`§2.1`). Honnête : OpenHands ouvre une PR + Planning-Mode → pas si caricatural ; le vrai reproche = gating par-action grossier. |
| **agency-swarm** (VRSEN) | coordinateur+agents ≈ bobby/gandalf/valerianus | — | **Réf archi seulement** (OpenAI-SDK ; nous = Claude Code/MCP). |
| **No-Hype pipeline** | notre `§5` l'incarne déjà | — | **Écarter comme source** (Skool payant, invérifiable). « session fraîche/étape » → cite cwc (PROGRESS.md), citable. |

## Bucket TASKLING (widget tokens — concept)
Rappel : le **model-router a été retiré** de starfleet (`§2.4`/`§8`). Taskling = outil **séparé opt-in**.

| Outil | Verdict |
|---|---|
| **headroom** (`headroomlabs-ai/headroom`) | **Retenir.** Delta tokens **par appel** (`headroom_stats` MCP, `output-savings` +IC), CLI-wrap/proxy transparent, orthogonal à `/model`. Compresse l'**entrée**, réduit vraiment la dépense. Adopter en mesure/expé. |
| **Caveman** (`juliusbrussee/caveman`) | **Écarter/test.** Compresse la **sortie** seulement, **+~1,5k tokens entrée/tour**, métrique **agrégée** (pas par appel) → gain net surévalué ; style télégraphique en conflit avec « réponses claires + questions dans le chat ». |

## Bucket LUMIA / GMAIL TRIAGE (ingestion — concept)

| Source | Verdict |
|---|---|
| second-brain (No-Hype) / `smixs/agent-second-brain` | **Prendre le pattern, pas le produit.** **classifieur read-only** (label seul, écriture par code déterministe) = Content-Based Router EIP / workflow Routing Anthropic → auditable, rayon de dégât borné. « ne jamais reclasser 2× le même expéditeur » = **cache clé=expéditeur** devant le classifieur. Tiering Haiku(classer)/gros(synthèse) recommandé. L'analogue public classe en 1 session → notre design est meilleur. Specs No-Hype invérifiables/payantes → ne pas citer/dépendre. |

## Bucket PLATFORM-STACK (infra)

| Outil | Verdict |
|---|---|
| **softwarity/plug** | **Écarter + correction.** « résoudre par nom, pas exposer de ports » = déjà notre Traefik. Réachabilité **intra-cluster only** → **ne permet PAS** à Microsoft/un collègue de résoudre `*.xefi.local` (contrairement à l'espoir de la note). ≈ Telepresence, sans auth, AGPL. Pour l'URL **externe** SSO : **tailscale/cloudflared**. Ports locaux : **Traefik** (`CHALLENGE.md` reco B) inchangé. |

## URLs vérifiées
anthropics/cwc-long-running-agents · mattpocock/skills · addyosmani/agent-skills ·
ogulcancelik/herdr · cosmtrek/mindwalk · lobehub/lobehub · VRSEN/agency-swarm ·
All-Hands-AI/OpenHands · headroomlabs-ai/headroom · juliusbrussee/caveman ·
smixs/agent-second-brain · softwarity/plug
