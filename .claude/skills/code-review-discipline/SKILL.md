---
name: code-review-discipline
description: Use during /REVIEW — the agent's own lightweight self-review pass before /CODE-SIMPLIFY, and before merge-request review comments are addressed.
---

# Discipline de revue

L'auto-review de l'agent a l'etape `/REVIEW` ne remplace jamais la revue humaine sur la MR. Elle sert a arriver a cette revue humaine avec le moins de bruit possible.

## Ce que l'auto-review verifie

1. Coherence avec `/SPEC` : le diff construit exactement ce qui etait acte, ni plus ni moins.
2. Coherence avec `/PLAN` : pas de tache ajoutee ou sautee sans le signaler.
3. Tests verts, pas de test desactive ou affaibli pour faire passer la suite.
4. Pas de valeur magique non extraite, pas de code mort, pas de commentaire qui decrit le "quoi" au lieu du "pourquoi".

## Recevoir une revue (humaine, apres /SHIP)

Un commentaire de revue merite une verification technique avant d'etre applique, pas un accord automatique. Si le commentaire semble incorrect ou base sur une hypothese fausse, le dire explicitement plutot que d'appliquer un changement qu'on ne comprend pas.

## Lien avec la sequence starfleet

Les points d'attention pour les relecteurs humains sont ecrits dans le `contextSummary` du `checkpoint: "reviewed"`. Ils voyagent avec la tache jusqu'a la MR ouverte par `/SHIP`.
