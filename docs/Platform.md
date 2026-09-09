# Le ticket en deux volets et la plateforme distante

Conception du 2026-09-09. Seule la route du ticket est écrite à ce jour ; le reste de ce document fixe le découpage avant le code.

## 1. Le ticket en deux volets

Aujourd'hui la story fonctionnelle et sa jumelle de test sont deux lignes de la table `story`. C'est correct en base et faux à l'écran : ce sont **deux volets d'un même ticket**, pas deux cartes.

- Le kanban n'affiche que les stories `functional`. La jumelle n'a jamais de carte propre — elle est déjà filtrée côté backlog.
- Le ticket ouvert porte deux onglets : **Fonctionnel** et **Tests**. Même référence, `PS-1` et `PS-1-T`, un seul objet à l'écran.
- Une seule route sert l'écran : `GET /api/stories/:id/ticket`, qui rend le volet fonctionnel, le volet test, la definition of done et la cascade de review. Les critères d'acceptation y manquent encore : la table existe, aucun dépôt ne l'écrit.
- La route répond à l'identifiant de l'un ou de l'autre volet : demander le ticket par la référence de la jumelle rend le même objet. Le front n'a pas à savoir lequel des deux il tient.

## 2. L'écriture en deux temps

L'ordre est imposé et il est déjà la moitié du garde-fou : **on ne peut pas penser les tests avant que le périmètre soit écrit**.

1. Le volet fonctionnel s'écrit d'abord. Tant qu'il n'est pas enregistré, l'onglet Tests est fermé.
2. Le volet test s'écrit ensuite : ce qu'on veut valider, pas comment. C'est la réponse à « qu'est-ce qui prouve que c'est fait ».
3. `spec_done` n'est prouvable qu'une fois les deux volets écrits. C'est la règle serveur existante (`TwinRequiredError`), elle prend ici son sens d'interface.

La suite ne change pas : architecture, plan à valider, TDD rouge, dev vert, QA, review en cascade, merge, flag, prod.

## 3. L'intention est distante, l'exécution est locale

Deux déploiements, deux responsabilités qui ne se recouvrent pas.

**Le hub, distant.** Le directeur y écrit les projets et les épiques, et les assigne. Il porte les comptes, les assignations et la boîte d'entrée des bugs. Il ne sait rien des sessions, des preuves ni des fichiers touchés.

**Le board, local, un par poste.** Il tire ce qui lui est assigné, alimente son backlog, lance les sessions, écrit les checkpoints et garde les preuves sur le disque. Il ne rend au hub que l'avancement. Le Claude Code qui travaille est celui du poste : le hub ne lance jamais de session et n'a besoin d'aucune clé d'API.

Ce que le hub sert au directeur, en lecture : où en est chaque ticket, et qui en est responsable. Rien d'autre — pas de code, pas de preuve, pas de session.

**Deux façons d'obtenir du travail, au choix.** Le directeur peut assigner une épique à quelqu'un ; à l'inverse une épique non assignée est prenable par qui veut. Même règle pour les incidents. Dans les deux cas la prise est enregistrée côté hub et exclusive : assigné ou pris, c'est le même verrou, seule l'initiative change.

| Objet | Vérité | Sens du flux |
|---|---|---|
| Compte, projet, épique, assignation | Hub | hub → local |
| Incident (bug, retour utilisateur) | Hub | hub → local |
| Story, jumelle, critères | Local | local → hub (résumé) |
| Checkpoint, preuve, fichier touché, session | Local uniquement | jamais remonté |
| État de la story, pourcentage de rollout | Local | local → hub |

Conséquences à tenir :

- **Prise de portée exclusive.** Assignée ou prise, une épique a un responsable et un seul. Le hub enregistre qui et à quelle heure ; une épique déjà prise revient en lecture seule chez les autres. C'est la même classe de problème que les collisions de fichiers, résolue au même endroit : par un refus, pas par une alerte.
- **Idempotence.** Chaque objet tiré porte son `origin` et son `origin_id`. Re-tirer ne duplique rien.
- **Le hub ne voit pas les preuves.** Les fichiers `.claude/evidence/` restent locaux. Le hub apprend qu'une étape est prouvée, jamais son contenu — sinon la plateforme devient un dépôt de code par la petite porte.
- **Le local fonctionne hors ligne.** Le hub tombe, les sessions continuent ; la remontée rattrape au retour.

## 4. Les bugs, en dehors du backlog

Un bug n'est pas une story, c'est une **entrée à trier**. Le hub porte une boîte d'entrée, et la source est interchangeable : Sentry, GlitchTip, un autre collecteur d'erreurs, un formulaire de retour utilisateur, la saisie manuelle. Chaque source se réduit à trois champs — une empreinte, un titre, une charge utile — et le tri ne connaît que ça. Sentry est la première branchée, pas la seule prévue.

Le cycle :

1. La source poste sur le hub. L'entrée arrive à l'état `nouveau`, groupée par empreinte pour ne pas créer cent tickets d'une même exception.
2. Un humain **accepte ou refuse**. Rien ne devient une story sans cette validation — automatiser jusqu'à la story reviendrait à laisser Sentry remplir le backlog.
3. Une entrée acceptée devient une story fonctionnelle dans le projet visé, prête à être tirée.
4. Le volet Tests de cette story est le **test de non-régression** : le bug reproduit d'abord, rouge. C'est exactement le cycle TDD, l'entrée Sentry fournit le rouge.
5. La story suit la séquence complète. Rien n'est raccourci parce que c'est un bug.
6. Le merge met en prod **derrière un feature flag**, montée progressive. Le collecteur surveille la même empreinte : plus d'occurrence sur le périmètre activé, on monte ; ça réapparaît, on redescend à zéro sans redéployer.

La boucle se ferme : l'erreur en prod devient un ticket, le ticket devient une session, la session revient en prod derrière un flag surveillé par la source qui a signalé l'erreur.

## 5. Les sessions concurrentes

Le point de départ de tout : **pendant que Claude travaille sur une story, on en prépare une autre**. Ce qui suppose trois choses que le board doit tenir.

- **Une session par story**, lancée depuis la carte, pas depuis un terminal. L'Agent SDK la pilote, le board garde l'identifiant.
- **Un nombre de sessions simultanées plafonné**, et le plafond n'est pas décoratif : au-delà, le lancement est refusé. Le critère est la ressource machine, pas l'envie.
- **Aucune session ne bloque l'interface.** L'écriture d'une story pendant qu'une autre construit est le cas normal, pas l'exception.

Et un plafond de coût par story, qui **agit** au lieu d'avertir. Ce qu'il fait à la limite n'est pas décidé par le board : c'est un réglage de la personne, parmi trois conduites.

| Conduite | Effet à la limite |
|---|---|
| `stop` | La session est tuée, la story passe en `escalated` avec sa raison |
| `downgrade` | La session repart sur un modèle Claude moins cher et continue |
| `reroute` | La session repart chez un autre fournisseur, par un routeur, et continue |

Aucune n'est le bon défaut pour tout le monde : `stop` protège une facture à l'usage, `downgrade` protège une fenêtre de forfait, `reroute` ne protège rien mais ne s'arrête jamais. Le choix vit dans les réglages du poste, et une story peut le surcharger — un correctif de production ne s'arrête pas parce qu'un plafond générique a été atteint.

Ce qui n'est pas au choix : la limite s'applique. Les trois conduites font quelque chose ; aucune n'est « prévenir et continuer ».

## 6. Deux stacks, parce que la frontière est nette

Le board local reste **TypeScript sur Node + Hono + `better-sqlite3`**. Ce n'est pas négociable : c'est lui qui pilote les sessions, et l'Agent SDK n'existe qu'en TypeScript et en Python.

Le hub part sur **Laravel + `lomkit/laravel-rest-api`**. Il ne lance aucune session, n'a besoin d'aucune clé d'API, et n'est que du CRUD multi-utilisateurs avec authentification, permissions, assignations et webhooks — soit exactement ce que Laravel fait sans qu'on écrive quoi que ce soit. Socialite branche Entra ID sans écrire de couche OIDC, lomkit sert les projets, épiques et incidents avec leurs filtres sans endpoint sur mesure, et mentis sait relire du Laravel : le hub est dogfoodable, ce qu'un hub en TypeScript ne serait pas davantage.

Le prix à payer, assumé : deux chaînes d'outillage, deux déploiements, et un contrat HTTP à garder synchrone entre les deux. Ça tient parce que la frontière — l'intention contre l'exécution — ne bougera pas.

OSDD des deux côtés, `technical/` et `domain/`, `technical/` n'important jamais `domain/`.

## 7. Ce que ça ajoute en base

Côté local, quatre changements :

- `epic` et `story` gagnent `origin` et `origin_id`.
- `epic` gagne l'assignation tirée du hub, en lecture seule.
- une table `incident` locale, miroir de ce qui a été tiré, pour tracer story → incident d'origine.
- rien à `checkpoint`, `review_pass` ni `file_touch` : ils restent hors du hub.

Côté hub, un schéma neuf et beaucoup plus petit : comptes, projets, épiques, assignations, incidents, prises de portée. Pas de checkpoints, pas de sessions, pas de preuves.

## 8. Tranché, et ce qui reste ouvert

- **Le transport.** Tirer par appel HTTP à la demande, ou abonnement SSE depuis le hub. L'appel à la demande suffit au départ et évite d'exposer le poste local.
- **L'authentification.** Identifiant et mot de passe pour démarrer, puis SSO — Microsoft Entra ID en premier. Ce qui veut dire : l'identité est une table à part dès le premier jour, jamais une colonne sur le compte, et le mot de passe est un fournisseur d'identité parmi d'autres. Un jeton par poste pour le board local, émis par le hub et révocable, indépendamment du mode de connexion de l'humain.
- **Le stockage du hub.** SQLite tant qu'il y a un directeur et une équipe ; Postgres dès qu'il y a plusieurs organisations.
- **Le nom.** `starfleet` reste, `forge` est un nom de branche. Deux projets publics s'appellent déjà Forge.
- **La licence.** MIT pour démarrer : elle nous laisse vendre. Elle laisse aussi un concurrent reprendre le produit tel quel — à rouvrir seulement si ça devient un enjeu.
