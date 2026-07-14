---
name: verification-before-shipping
description: Use before /SHIP, or whenever about to claim work is complete, fixed, or passing — before committing or opening a merge request.
---

# Verification avant livraison

Ne jamais affirmer "ca marche" ou "les tests passent" sans avoir reellement fait tourner la commande et lu sa sortie. Une affirmation sans preuve est le point de depart des regressions silencieuses.

## Ce qu'il faut avant d'affirmer

1. La suite de tests complete a ete executee dans cette session, pas seulement supposee verte parce qu'elle l'etait avant les derniers changements.
2. La sortie de la commande a ete lue en entier — un exit code non verifie n'est pas une preuve.
3. Si un test a ete modifie ou supprime pour faire passer la suite, c'est signale explicitement, pas passe sous silence.

## Regle d'or de starfleet

**Aucun passage a `/SHIP` sans tests verts, peu importe qui a ecrit le code.** Cette regle ne se contourne pas, meme sous pression de delai. Si un test est rouge, retourne a `/BUILD` plutot que de forcer `/SHIP`.

## Lien avec la sequence starfleet

`/SHIP` verifie ce prerequis avant de pousser la branche et d'ouvrir la MR en draft. Le `checkpoint: "mr_draft_pushed"` bascule le statut en `awaiting_human` : a partir de la, la revue humaine (dev auteur + 2 collegues) prend le relais, elle ne remplace pas cette verification, elle vient apres.
