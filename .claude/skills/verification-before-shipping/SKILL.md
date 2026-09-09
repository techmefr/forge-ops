---
name: verification-before-shipping
description: Use during /VERIFY and before /SHIP, or whenever about to claim work is complete, fixed, or passing — before committing or opening a merge request.
---

# Verification avant livraison

Ne jamais affirmer "ca marche" ou "les tests passent" sans avoir reellement fait tourner la commande et lu sa sortie. Une affirmation sans preuve est le point de depart des regressions silencieuses.

## Ce qu'il faut avant d'affirmer

1. La suite de tests complete a ete executee dans cette session, pas seulement supposee verte parce qu'elle l'etait avant les derniers changements.
2. La sortie de la commande a ete lue en entier — un exit code non verifie n'est pas une preuve.
3. Si un test a ete modifie ou supprime pour faire passer la suite, c'est signale explicitement, pas passe sous silence.

## Une suite verte ne prouve pas la story

Le vert prouve que le code fait ce que le test dit. Il ne prouve pas que la story marche. C'est pour ca que `/VERIFY` existe entre `/BUILD` et `/REVIEW` : parcourir le chemin decrit par la story pour de vrai, dans le navigateur pilote quand elle est visible, par un aller-retour reel sur l'API quand elle ne l'est pas. Les cas de refus se parcourent autant que le cas nominal.

## Regle d'or de forge

**Une etape se prouve par un fichier, jamais par une affirmation.** Chaque checkpoint exige un `evidencePath` non vide, et le board refuse une etape hors sequence. Si tu n'as pas pu executer ce que tu devais observer, dis-le et arrete-toi — ne prouve pas une etape que tu n'as pas franchie.

## Lien avec la sequence forge

`/VERIFY` ecrit `.claude/evidence/<REFERENCE>/verified.md` : ce qui a ete parcouru, ce qui a ete observe, les captures ou les reponses brutes collees. `/SHIP` relit ensuite la definition of done complete via `GET /api/stories/:id/dod` : si une seule des six etapes est a `proven: false`, il n'y a pas de livraison. La derniere porte reste humaine — la story attend en `shipping`, elle ne passe pas en `done` toute seule.
