---
name: extract-conventions
description: Use quand on démarre sur un projet ou qu'on veut rafraîchir ses docs de référence — génère depuis le CODE RÉEL un brouillon des conventions observées, au lieu de les écrire à la main.
---

# extract-conventions

Brique de **setup / maintenance** (pas une étape du pipeline). Rend les agents plus forts en
leur donnant des références **ancrées dans le vrai code**, et automatise la récupération du
savoir *interne* d'un projet. Complète `SOURCING-INBOX` (qui, lui, ramasse le savoir *externe*).

## Quand
Au démarrage sur un projet, ou pour rafraîchir les références avant que `review`/`code`/`archi`
s'appuient dessus. Toujours à la demande d'un humain.

## Étapes
1. Lire le code réel via **graphify** + lecture ciblée : structure, patterns récurrents,
   nommage, réponses back, composants front, tokens design réellement utilisés, patterns de test.
2. Extraire les **conventions observées** par domaine (front / back / tests / design).
3. Émettre un **brouillon** `references/observed/<projet>.md` — marqué **INTERNE**
   (il contient des specifics du projet).
4. **Ratification humaine** : le dev valide / corrige. Ce qui est validé **et générique** est
   distillé (à la main) vers les conventions publiables (`references/conventions-*.md`) ; le
   reste demeure interne.
5. Rejouable : relancer produit un diff vs la version précédente (dérive visible).

## Sortie / checkpoint
`references/observed/<projet>.md` (interne) + éventuelle mise à jour des conventions génériques
après ratification. Pas de checkpoint pipeline.

## Garde-fous
- **L'auto propose, l'humain ratifie** — la sortie n'a aucune autorité tant qu'elle n'est pas
  validée. On extrait ce que le code *fait* (bonnes ET mauvaises habitudes) ≠ ce qu'il *devrait*.
- **Interne par défaut** (règle C) : généré depuis un vrai projet → le publiable est une
  distillation humaine, sans nom de projet/collègue.
- **Lecture seule** du projet : on lit, on n'édite jamais le code.
- **À la demande**, jamais un hook automatique (le « doc-freshness » auto a été retiré exprès).

## Origine
Interne `graphify` + `mattpocock` (improve-codebase-architecture) + `addyosmani`
(source-driven-development / context-engineering), réécrit à notre sauce.
