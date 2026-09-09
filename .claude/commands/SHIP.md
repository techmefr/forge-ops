---
description: Livrer la story derriere une validation humaine
---

Etape 8 de la sequence forge. Prerequis : les six checkpoints prouves. Verifie avec `GET /api/stories/:id/dod` : si une seule etape est a `proven: false`, arrete-toi et reprends a celle-la.

Aucun agent ne clot une story tout seul. La derniere porte est humaine.

1. Relis la definition of done complete et affiche-la a l'utilisateur : les six etapes, leur preuve, le chemin de chaque preuve.
2. Commite sur la branche dediee a la story. Message en anglais, conventional commit, description en minuscule. Aucune trace d'IA dans le code ni dans les messages.
3. Pousse et ouvre la demande de fusion vers la branche d'integration du projet.
4. Demande la validation humaine. Tant qu'elle n'est pas donnee, la story reste en `shipping`, pas en `done`.
5. En cas de conflit de fusion, ne force rien : le board le signale sur la carte kanban, et la resolution se delegue explicitement.
6. Une fois la validation obtenue, passe la story en `done`. Sa jumelle de test suit le meme sort.
