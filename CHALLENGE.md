# Challenge terrain — starfleet confronté aux vrais projets Xefi

> Épreuve de vérité : est-ce que starfleet, **tel qu'il est codé aujourd'hui**, marcherait
> sur skera / nexeren / platform (stacktim) / formation ? Réponse honnête, sourcée sur le
> code réel de ces projets (lecture seule). À reprendre pour trouver les solutions.

## Verdict en une ligne

La couche **méthode / état / worktree / dashboard** de starfleet marcherait. Sa couche
**runtime (allocation de port + `start_server`) ne marche PAS** : elle est pensée pour « un
process nu qui écoute sur `$PORT` », or **tous** les projets Xefi sont des **stacks Docker
Compose multi-services**. C'est exactement la friction vécue — et starfleet tel quel ne la
résout pas.

## Preuve n°1 — le lancement réel (dans notre propre launch.json)

```
cd ~/skera-nexeren/skera-front-web
make up && docker compose -p skera-skera-front-web exec -T app bash -c 'npm run dev'
```

Le dev tourne **dans un conteneur**, démarré par `make up`. Ce n'est pas un process hôte.
Et le compose publie `"${APP_PORT}:3000"` → le port vient de `.env`, **pas** d'un `PORT`
injecté.

## Ce qui casse (concret, par projet)

| # | Problème | Détail |
|---|---|---|
| 1 | `start_server` ne correspond à aucun lancement | starfleet fait `spawn(runCommand)` détaché + `PORT` injecté + suit un PID. La réalité : `make up` / `sail up` → conteneurs. `stop_server` ne peut pas tuer un `docker compose` (pas son PID). **Le start/stop ne pilote pas Docker.** |
| 2 | 1 port déterministe vs ~7 ports/stack | starfleet alloue **un** numéro par (projet, branche). Chaque back Sail publie `APP_PORT`(80) + `FORWARD_DB_PORT`(3306) + redis(6379) + elastic(9200) + mailpit + vite. Le `PORT` injecté **n'est lu par aucun compose** (ils lisent `APP_PORT`/`FORWARD_*`). → Les vraies collisions (80/3306/9200) **restent entières**. |
| 3 | `nexeren-api` casse même l'idée d'offset | `docker-compose.yml` **code en dur** `'9200:9200'` et `'9300:9300'` (aucune variable). Même en écrivant des offsets dans `.env`, ces deux ports collisionnent toujours avec l'ES de skera. |
| 4 | Le stack d'une worktree ré-introduit tout | `launch_worktree` (git worktree add) est OK, mais faire tourner le stack de la worktree = un **2e** `docker compose up` (encore 80/3306/9200) → collision avec le checkout principal. starfleet ne coordonne pas les ports du stack de la worktree. |
| 5 | `finish_task` suppose `develop` | Fait `git checkout develop && pull`. Hypothèse en dur, à vérifier repo par repo (échoue en silence si `main`). |
| 6 | URL `localhost:port` fausse pour platform | `platform-stack` est **déjà un reverse-proxy Traefik** (domaines, pas `localhost:port`). Et on ne veut pas de `localhost` (SSO Microsoft). |
| 7 | Honor-system | starfleet ne voit que ce qui passe par `create_task`. Les lancements réels (`make up`, `sail up`) le contournent. Il ne lit pas `docker ps` → « ce qui tourne vraiment » n'apparaît pas. |

## Ce qui tient (agnostique du runtime — marche chez nous sans changement)

| Couche | Marche ? |
|---|---|
| worktree (create / launch / finish) | ✅ |
| état / checkpoint / escalate / task_items | ✅ |
| doc d'archi vivante (`set_arch_node`) | ✅ |
| dashboard (multi-projets, chips, i18n, RGAA) | ✅ (si alimenté) |
| méthode construct (pipeline, review, MR) | ✅ |
| **allocation de port + start/stop + URL localhost** | ❌ (modèle process-nu ≠ Docker) |

## Le pivot (pistes à creuser à la maison)

La valeur de starfleet chez nous n'est **pas** d'allouer des ports — c'est **tracker,
coordonner, rendre visible**. Le port/URL se gère **au niveau compose**, pas via un `PORT`
injecté.

- **A — starfleet gère le `.env` du stack** : au lieu d'injecter `PORT`, il écrit un jeu
  d'**offsets** (`APP_PORT`, `FORWARD_DB_PORT`, …) dans le `.env` du projet/worktree, et
  `start_server` devient `make up` / `docker compose up` (pas un spawn hôte). Bloqué par le
  hardcode ES de `nexeren-api` tant qu'il n'est pas variabilisé.
- **B — généraliser le Traefik qu'on a déjà** (`platform-stack`, `pilota/docker-compose.traefik.yml`)
  à skera/nexeren → **domaines fixes, zéro port publié, zéro collision**, URL stable pour le
  SSO Microsoft. starfleet ne fait plus **que** l'état + la visibilité + les worktrees. Cohérent
  avec « ne pas réinventer la plomberie ».

**Reco : B pour les ports/URLs** (le pattern existe déjà en interne), et **on ampute (ou on
restreint) la couche port-allocation de starfleet** — la garder seulement pour les vrais
process-nu (ex. `datacenter-3d`, un `npm run dev` qui lit `PORT`). Sinon on présente un outil
dont le cœur annoncé (« ports déterministes ») ne se déclenche jamais sur nos propres stacks.

## À vérifier / faire ensuite

- [ ] Variabiliser `nexeren-api` ES (`${ES_HTTP_PORT:-9200}:9200`, `${ES_TRANSPORT_PORT:-9300}:9300`).
- [ ] Décider A vs B (reco : B).
- [ ] Généraliser un `docker-compose.traefik.yml` skera/nexeren sur le modèle pilota/platform.
- [ ] Rendre `finish_task` configurable sur la branche de base (pas `develop` en dur).
- [ ] Décider du sort de `src/ports.ts` + `start_server` (amputer / restreindre aux process-nu).
- [ ] Faire lire `docker ps` au dashboard pour refléter le réel, pas seulement le déclaré.
