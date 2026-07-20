---
name: review
description: Use quand le GATE est vert, avant la simplification — revue sur deux axes parallèles (Standards + Spec) puis passe des agents Xefi.
---

# review

Étape 8 du pipeline (`WORKFLOW.md`). Deux regards indépendants, qui ne se polluent pas.

## Quand
Après `gate` (`verified`), avant `simplify`.

## Étapes
1. Lancer **deux sous-agents en parallèle** (contextes séparés, ne se polluent pas) :
   - **axe Standards** : conventions Xefi + code-smells (réutilisation, simplification, CSS dupliqué).
   - **axe Spec** : le diff est-il **fidèle au ticket / à la spec** ? (ce que `/code-review` natif
     ne couvre pas). Skip propre si aucune spec.
2. Agréger les deux côte à côte.
3. Passe des **agents Xefi** dans la voix du dev : `bobby`/`bobby-react` puis `valerianus`
   (tri, reformulation, anti-débat stérile).
4. Pour la profondeur : `/code-review` + `/security-review` natifs (gandalf en gate final).

## Sortie / checkpoint
`reviewed`.

## Garde-fous
Les deux axes restent **indépendants** (pas de contexte partagé). On invoque le natif, on ne
le réimplémente pas. Commentaires simples, sans emojis/flèches, minuscule en début de phrase.

## Origine
`mattpocock/skills` (code-review 2 axes non-polluants) + agents Xefi + natif, réécrit.
