---
name: brainstorm
description: Use quand une feature démarre, avant toute spec ou code — explore l'intention réelle et les options avant de verrouiller quoi que ce soit.
---

# brainstorm

Étape 1 du pipeline (`WORKFLOW.md`). Explorer le *pourquoi* et les approches possibles
avant de figer le périmètre.

## Quand
Juste après `start-feature`, avant `/SPEC`. Dès qu'on n'est pas certain à 100 % du besoin réel.

## Étapes
1. Reformuler le besoin réel (le problème, pas la solution demandée).
2. Lister 2-3 approches possibles avec leurs compromis.
3. Repérer les risques et les zones floues.
4. Noter un hors-scope pressenti et les questions ouvertes pour le dev/humain.

## Sortie / checkpoint
Pas de checkpoint formel — un résumé écrit dans `context_summary` (starfleet). Prépare `/SPEC`.

## Garde-fous
Aucun code. Les choix produit se remontent au dev/humain, on ne tranche pas seul.

## Origine
Natif Claude Code (skill `brainstorming`), réécrit à notre sauce.
