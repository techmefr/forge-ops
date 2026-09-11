---
description: Voir la story fonctionner pour de vrai, pas seulement en test
---

Etape 6 de la sequence forge. Prerequis : `build_done` prouve (`GET /api/stories/:id/dod`). Si absent, arrete-toi et demande `/BUILD`. Skill locale associee : `verification-before-shipping`.

Une suite verte prouve que le code fait ce que le test dit. Elle ne prouve pas que la story marche. Cette etape produit cette preuve-la.

1. Lance l'application et parcours le chemin decrit par la story, dans le navigateur pilote quand la story est visible, par un aller-retour reel sur l'API quand elle ne l'est pas.
2. Passe par les cas de refus autant que par le cas nominal : ce que la story interdit doit etre refuse, avec le bon code et le bon message.
3. Regarde la console et les requetes reseau, pas seulement le rendu. Une page correcte qui hurle en console n'est pas verifiee.
4. Si la story touche une interface : verifie le clavier, le focus visible, le contraste du texte normal, et le rendu en theme sombre comme en clair.
5. Capture la preuve dans `.claude/evidence/<REFERENCE>/verified.md` : ce qui a ete parcouru, ce qui a ete observe, les captures ou les reponses brutes. Titre les sections `## Ce qui a ete parcouru` et `## Ce qui a ete observe` : la preuve est refusee si une section manque ou si le fichier ne porte pas de vraie prose. Une affirmation sans sortie collee n'est pas une preuve.
6. Ne declare jamais verifie ce que tu n'as pas execute. Si tu n'as pas pu lancer l'application, dis-le et arrete-toi ici.
7. Prouve l'etape : `POST /api/stories/:id/checkpoints` avec `{"name":"verified","evidencePath":".claude/evidence/<REFERENCE>/verified.md"}`.
8. Rappelle que l'etape suivante est `/REVIEW`.
