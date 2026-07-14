---
name: test-driven-development
description: Use during /TEST and /BUILD, before writing any implementation code for a feature or bugfix.
---

# TDD dans la sequence starfleet

Le TDD genere par un agent peut etre masque ou contourne si personne ne verifie qu'il preuve quelque chose de reel. Cette discipline sert de garde-fou.

## Cycle non negociable

1. **Rouge** : ecris un test qui echoue pour la bonne raison (comportement absent), pas a cause d'une erreur de setup, de typage ou d'import. Lance-le et lis l'echec avant de continuer.
2. **Vert** : ecris le minimum de code pour faire passer ce test. Pas d'anticipation de fonctionnalites futures non demandees.
3. **Simplifie** : une fois vert, nettoie sans changer le comportement. Les tests deja verts sont ton filet de securite pour refactorer sans crainte — c'est le role de `/CODE-SIMPLIFY`.

## Ce qui invalide un test

- Un test qui passe des la premiere ecriture, avant meme l'implementation : il ne teste rien.
- Un mock qui remplace la logique testee elle-meme plutot qu'une dependance externe.
- Un test rouge qu'on fait passer en modifiant l'assertion plutot que le code.

## Lien avec la sequence starfleet

`/TEST` doit se terminer avec des tests rouges (`checkpoint: "tests_written"`). `/BUILD` doit se terminer avec ces memes tests verts (`checkpoint: "build_done"`). Si un echec se repete a l'identique pendant `/BUILD`, appelle `record_error` : deux occurrences identiques du meme hash declenchent une escalade automatique, ne pas insister en boucle.
