---
name: debug
description: Use dès qu'un bug, un échec de test inattendu ou une erreur répétée survient pendant le code — comprendre la cause avant de proposer un fix.
---

# debug

Brique de support de l'étape 6 (`code`). Trouver la **cause racine**, pas le symptôme.

## Quand
Pendant `code` / `/BUILD`, à la première erreur inattendue ou au deuxième échec identique.

## Étapes
1. Reproduire de façon fiable (commande + entrée minimale).
2. Isoler : formuler une hypothèse unique, la vérifier (log/test ciblé), avant d'en changer.
3. Corriger la **cause**, pas le symptôme ; ajouter/ajuster un test qui capture le cas.
4. Toujours en boucle > 2 tentatives sans progrès → `escalate`.

## Sortie / checkpoint
Pas de checkpoint propre — reprend `code`.

## Garde-fous
Pas de fix « au hasard » ni de retry en boucle. Une hypothèse à la fois.

## Origine
Natif / interne `systematic-debugging`, réécrit à notre sauce.
