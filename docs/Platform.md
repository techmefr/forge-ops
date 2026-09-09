# Le ticket en deux volets et la plateforme distante

Conception du 2026-09-09. Rien de tout ceci n'est implémenté : ce document fixe le découpage avant le code.

## 1. Le ticket en deux volets

Aujourd'hui la story fonctionnelle et sa jumelle de test sont deux lignes de la table `story`. C'est correct en base et faux à l'écran : ce sont **deux volets d'un même ticket**, pas deux cartes.

- Le kanban n'affiche que les stories `functional`. La jumelle n'a jamais de carte propre — elle est déjà filtrée côté backlog.
- Le ticket ouvert porte deux onglets : **Fonctionnel** et **Tests**. Même référence, `PS-1` et `PS-1-T`, un seul objet à l'écran.
- Une seule route sert l'écran : `GET /api/stories/:id/ticket`, qui rend le volet fonctionnel, le volet test, les critères d'acceptation, la definition of done et la cascade de review.

## 2. L'écriture en deux temps

L'ordre est imposé et il est déjà la moitié du garde-fou : **on ne peut pas penser les tests avant que le périmètre soit écrit**.

1. Le volet fonctionnel s'écrit d'abord. Tant qu'il n'est pas enregistré, l'onglet Tests est fermé.
2. Le volet test s'écrit ensuite : ce qu'on veut valider, pas comment. C'est la réponse à « qu'est-ce qui prouve que c'est fait ».
3. `spec_done` n'est prouvable qu'une fois les deux volets écrits. C'est la règle serveur existante (`TwinRequiredError`), elle prend ici son sens d'interface.

La suite ne change pas : architecture, plan à valider, TDD rouge, dev vert, QA, review en cascade, merge, flag, prod.

## 3. L'intention est distante, l'exécution est locale

Deux déploiements, deux responsabilités qui ne se recouvrent pas.

**Le hub, distant.** Le directeur y écrit les projets et les épiques, et les assigne. Il porte les comptes, les assignations et la boîte d'entrée des bugs. Il ne sait rien des sessions, des preuves ni des fichiers touchés.

**Le board, local, un par poste.** Il tire ce qui lui est assigné, alimente son backlog, lance les sessions, écrit les checkpoints et garde les preuves sur le disque. Il ne rend au hub que l'avancement.

| Objet | Vérité | Sens du flux |
|---|---|---|
| Compte, projet, épique, assignation | Hub | hub → local |
| Incident (bug, retour utilisateur) | Hub | hub → local |
| Story, jumelle, critères | Local | local → hub (résumé) |
| Checkpoint, preuve, fichier touché, session | Local uniquement | jamais remonté |
| État de la story, pourcentage de rollout | Local | local → hub |

Conséquences à tenir :

- **Prise de portée.** On ne « reçoit » pas une épique, on la **prend**. Le hub enregistre qui l'a prise et à quelle heure ; une épique prise ailleurs revient en lecture seule. C'est la même classe de problème que les collisions de fichiers, résolue au même endroit : par un refus, pas par une alerte.
- **Idempotence.** Chaque objet tiré porte son `origin` et son `origin_id`. Re-tirer ne duplique rien.
- **Le hub ne voit pas les preuves.** Les fichiers `.claude/evidence/` restent locaux. Le hub apprend qu'une étape est prouvée, jamais son contenu — sinon la plateforme devient un dépôt de code par la petite porte.
- **Le local fonctionne hors ligne.** Le hub tombe, les sessions continuent ; la remontée rattrape au retour.

## 4. Les bugs, en dehors du backlog

Un bug n'est pas une story, c'est une **entrée à trier**. Le hub porte une boîte d'entrée alimentée par trois sources : Sentry (erreurs), les retours utilisateurs (idées, bugs signalés), et la saisie manuelle.

Le cycle :

1. Sentry poste sur le hub. L'entrée arrive à l'état `nouveau`, groupée par empreinte pour ne pas créer cent tickets d'une même exception.
2. Un humain **accepte ou refuse**. Rien ne devient une story sans cette validation — automatiser jusqu'à la story reviendrait à laisser Sentry remplir le backlog.
3. Une entrée acceptée devient une story fonctionnelle dans le projet visé, prête à être tirée.
4. Le volet Tests de cette story est le **test de non-régression** : le bug reproduit d'abord, rouge. C'est exactement le cycle TDD, l'entrée Sentry fournit le rouge.
5. La story suit la séquence complète. Rien n'est raccourci parce que c'est un bug.
6. Le merge met en prod **derrière un feature flag**, montée progressive. Sentry surveille la même empreinte : plus d'occurrence sur le périmètre activé, on monte ; ça réapparaît, on redescend à zéro sans redéployer.

La boucle se ferme : l'erreur en prod devient un ticket, le ticket devient une session, la session revient en prod derrière un flag surveillé par la source qui a signalé l'erreur.

## 5. Les sessions concurrentes

Le point de départ de tout : **pendant que Claude travaille sur une story, on en prépare une autre**. Ce qui suppose trois choses que le board doit tenir.

- **Une session par story**, lancée depuis la carte, pas depuis un terminal. L'Agent SDK la pilote, le board garde l'identifiant.
- **Un nombre de sessions simultanées plafonné**, et le plafond n'est pas décoratif : au-delà, le lancement est refusé. Le critère est la ressource machine, pas l'envie.
- **Aucune session ne bloque l'interface.** L'écriture d'une story pendant qu'une autre construit est le cas normal, pas l'exception.

## 6. Ce que ça ajoute en base

Côté local, quatre changements :

- `epic` et `story` gagnent `origin` et `origin_id`.
- `epic` gagne l'assignation tirée du hub, en lecture seule.
- une table `incident` locale, miroir de ce qui a été tiré, pour tracer story → incident d'origine.
- rien à `checkpoint`, `review_pass` ni `file_touch` : ils restent hors du hub.

Côté hub, un schéma neuf et beaucoup plus petit : comptes, projets, épiques, assignations, incidents, prises de portée. Pas de checkpoints, pas de sessions, pas de preuves.

## 7. Ce qui reste à trancher

- **Le transport.** Tirer par appel HTTP à la demande, ou abonnement SSE depuis le hub. L'appel à la demande suffit au départ et évite d'exposer le poste local.
- **L'authentification.** Un jeton par poste, émis par le hub, révocable. Pas de compte partagé.
- **Le stockage du hub.** SQLite tant qu'il y a un directeur et une équipe ; Postgres dès qu'il y a plusieurs organisations.
- **Le nom.** `starfleet` reste, `forge` est un nom de branche. Deux projets publics s'appellent déjà Forge.
