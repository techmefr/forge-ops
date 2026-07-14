---
name: systematic-debugging
description: Use whenever encountering a bug, unexpected test failure, or repeated error during /BUILD, before proposing a fix.
---

# Debogage systematique

Ne propose jamais un correctif avant d'avoir compris la cause reelle. Un correctif qui fait taire le symptome sans comprendre la cause revient tot ou tard, souvent aggrave.

## Demarche

1. Reproduis l'erreur de maniere fiable avant de toucher au code.
2. Lis le message d'erreur en entier, la stack trace complete, pas juste la premiere ligne.
3. Formule une hypothese explicite sur la cause avant de modifier quoi que ce soit.
4. Verifie l'hypothese par une observation (log, test isole, print), pas par intuition.
5. Corrige la cause identifiee, pas le symptome le plus proche.
6. Relance la suite de tests complete, pas seulement le test qui echouait.

## Detection de boucle

Si la meme erreur revient a l'identique apres une tentative de correction, c'est le signe que l'hypothese de depart etait fausse — changer d'angle plutot que de retenter la meme correction.

## Lien avec la sequence starfleet

Chaque tentative infructueuse incremente `attempt_count` via `record_attempt` (cap dur a 5). Chaque erreur est hashee et comparee via `record_error` : deux hashs identiques consecutifs declenchent une escalade immediate vers `status: escalated`, sans attendre le cap de tentatives. Ne pas essayer de contourner cette escalade — elle signale qu'un humain doit reprendre la main.
