---
name: code-review-discipline
description: Use during /REVIEW, when reading the full diff of a story through the quality, security and accessibility lenses, and when addressing review comments received afterwards.
---

# Discipline de revue

La review d'un agent ne remplace pas la validation humaine finale. Elle sert a arriver a cette validation avec le moins de bruit possible, et surtout sans defaut de correction restant.

## Trois lentilles, dans cet ordre

La review se lit en cascade : qualite, puis securite, puis accessibilite. Chaque passe relit le diff entier avec sa propre lentille, sans reprendre les conclusions de la precedente — une passe qui se contente de dire "deja couvert plus haut" n'a pas eu lieu.

1. **Qualite** : correction d'abord. Le diff construit exactement ce que la story actait, ni plus ni moins. Puis reutilisation de ce qui existe deja, simplification, placement dans la bonne couche (`technical/` n'importe jamais `domain/`). Pas de valeur magique, pas de code mort, pas de commentaire.
2. **Securite** : autorisation manquante, surface d'injection, secret expose, charge utile non validee a une frontiere.
3. **Accessibilite** : semantique, navigation clavier, focus visible, contraste, libelle des controles icone. Sans interface touchee, la passe se conclut en une ligne — pas en silence.

## Severite

Un finding est `strong` ou `weak`, et ce choix n'est pas negociable apres coup.

- `strong` : la story ne peut pas partir en l'etat. Tout defaut de correction est `strong`.
- `weak` : a savoir, ne bloque pas.

Ne baisse jamais une severite pour debloquer une story. Le board refuse de prouver `reviewed` tant qu'un finding `strong` n'est pas resolu, et c'est le comportement voulu.

## Tests

Une suite verte obtenue en desactivant, en affaiblissant ou en supprimant un test n'est pas une suite verte. Si un test a bouge pendant `/BUILD`, la review le regarde en premier.

## Recevoir une revue humaine

Un commentaire de revue merite une verification technique avant d'etre applique, pas un accord automatique. Si le commentaire semble incorrect ou repose sur une hypothese fausse, le dire explicitement plutot que d'appliquer un changement qu'on ne comprend pas.

## Lien avec la sequence forge

`/REVIEW` vient apres `/VERIFY` et avant `/SHIP`. La synthese des trois passes s'ecrit dans `.claude/evidence/<REFERENCE>/reviewed.md` : findings par lentille, ce qui a ete corrige, ce qui reste en `weak` et pourquoi. C'est ce fichier que lit l'humain a la derniere porte.
