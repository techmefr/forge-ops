---
name: over-engineering-review
description: Use quand on relit un diff ou un repo entier pour ne chercher qu'une seule chose — ce qui peut être supprimé (code mort, réinvention de stdlib, sur-abstraction, anticipation non demandée). Complémentaire des reviewers de diff/gandalf (qui jugent correctness et conventions) et du skill natif simplify (qui applique les fixes) : ici on ne fait que scorer et lister, angle suppression pur.
---

# over-engineering-review

Étape `simplify` (9) du pipeline (`WORKFLOW.md`), ou mode ponctuel sur un diff avant merge.
Une seule question posée à chaque ligne du périmètre : **est-ce que ça peut disparaître sans
rien casser ?** Pas de jugement de correctness (le reviewer de diff), pas de jugement de convention (les
briques `*-conventions`) — uniquement la chasse à ce qui n'aurait jamais dû être écrit.

## Quand
- En complément du reviewer de diff/`gandalf` sur une MR, quand un diff semble plus gros que le besoin
  ne le justifie.
- En audit ponctuel d'un repo entier (pas seulement un diff) quand une dette de sur-ingénierie
  est suspectée.
- Comme matière première du skill natif `simplify`, qui applique ensuite les suppressions
  retenues — cette brique ne corrige rien elle-même, elle liste et score.

## Étapes

### Mode diff (un changement en cours)
Parcourir uniquement les lignes ajoutées/modifiées du diff. Pour chaque candidat trouvé,
une ligne de finding avec un tag :

- `à-supprimer:` — code mort, jamais appelé, ou dupliqué d'un helper existant déjà présent
  dans le repo (voir aussi [[reuse-existing-components-before-creating]]).
- `stdlib:` — fonction/utilitaire réinventé alors que le langage, le framework ou une lib déjà
  installée le fait nativement.
- `sur-abstraction:` — interface, wrapper ou couche de délégation qui n'a qu'un seul
  appelant réel — l'abstraction ne sert à rien tant qu'un deuxième cas d'usage n'existe pas.
- `yagni:` — fonctionnalité, option ou paramètre anticipé pour un besoin non demandé
  aujourd'hui (flag, chunking préventif, cache, config non exploitée).
- `à-réduire:` — même comportement atteignable avec sensiblement moins de code (branches
  mortes, cas jamais atteints, indirection inutile).

Format d'un finding : `<tag> fichier:ligne — quoi, en une phrase`. Pas de paragraphe, pas de
justification développée (cf. [[short-review-checklist-items]]) — le dev répare ou demande.

### Mode audit (repo entier)
Même grille de tags, balayage large plutôt que diff. Priorité aux modules les plus anciens ou
les moins touchés récemment (git blame ancien = moins de chances d'avoir déjà été nettoyés).

## Sortie / checkpoint
Une liste de findings tagués, terminée par un score global :
- `net: -N lignes possibles` si des suppressions concrètes sont trouvées, N = estimation basse
  de lignes supprimables sans rien casser.
- `déjà lean, rien à signaler` si le périmètre ne présente aucun candidat — un audit qui ne
  trouve rien est un résultat valide, pas un échec de la review.

## Garde-fous
Ne corrige jamais soi-même — cette brique liste, `simplify` (skill natif) ou le dev appliquent.
Ne pas confondre avec une review de correctness : un bug potentiel repéré en chemin se signale
séparément (au reviewer de diff/gandalf), pas mélangé dans cette liste. Un candidat `sur-abstraction`
nécessite de vérifier qu'il n'y a vraiment qu'un seul appelant (grep avant de trancher) — pas
de suppression sur une supposition.

## Origine
Idée reprise de DietrichGebert/ponytail (skills `ponytail-review`/`ponytail-audit` — angle
suppression exclusif, tags par catégorie, score net de lignes) — mécanisme et tags réécrits
dans le vocabulaire des briques construct, pas de texte copié.
