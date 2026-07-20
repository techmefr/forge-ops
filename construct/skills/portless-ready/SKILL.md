---
name: portless-ready
description: Use quand une stack doit passer en portless — rend un projet compatible vercel-labs/portless (route HTTPS nommée, arrêt des ports backing publiés, URLs front↔back alignées).
---

# portless-ready

Brique de **setup / infra** (pas une étape du pipeline). Rend une stack Docker exploitable via
**vercel-labs/portless** : une URL HTTPS stable par service, zéro collision de port, navigateur
Windows → conteneur WSL. C'est « l'agent qui corrige pour utiliser portless à chaque fois ».

## Quand
À la demande, avant de tester une stack dans le navigateur, ou en migrant un projet en portless.

## Étapes
1. **Vérifier portless installé** (CA trustée en WSL *et* Windows). Sinon : demander au dev de
   lancer l'installation — c'est un **changement système** (CA dans le Root store Windows),
   l'agent ne le fait pas.
2. **Identifier les entrées HTTP** à exposer (app, front, vite, mailpit) et leur port réel.
3. **Router** : `portless alias <projet>-<rôle> <port>` → `https://<projet>-<rôle>.localhost`
   (les worktrees préfixent la branche automatiquement).
4. **Hygiène de compose** (proposée, **ratifiée par le dev** — touche le vrai compose) : les
   services *backing* (db, redis, elasticsearch) **ne publient plus sur l'hôte** (ils se parlent
   par nom dans le réseau docker). S'ils doivent rester joignables par un outil externe (DBeaver),
   offset **conscient** au lieu de la valeur par défaut.
5. **Aligner les variables** front↔back sur les noms `.localhost` (`NUXT_BACKEND_URL`,
   `FRONT_END_URL`, etc.) — plus de resync manuelle à chaque changement de port.
6. **Vérifier** : navigateur Windows → `https://<projet>-<rôle>.localhost` → conteneur WSL.

## Sortie / checkpoint
Stack portless-ready : route(s) HTTPS nommée(s), zéro collision HTTP, variables alignées.
Pas de checkpoint pipeline.

## Garde-fous
- **portless = plomberie consommée**, pas réécrite. La brique qu'on possède, c'est *ce câblage*.
- **L'agent propose, l'humain ratifie** : toute modif de `compose`/`.env` réel passe par le dev.
- **Ne règle que l'HTTP(S).** Les ports non-HTTP (3306/6379/9200) se traitent par
  **non-publication** (intra-réseau) ou **offset conscient** — portless ne les couvre pas.
- **À la demande**, jamais un hook auto. Installer portless = action humaine (change système).
- **SSO Microsoft** : l'URL `https://<...>.localhost` comme redirect URI Azure AD est **à
  vérifier** côté Azure — ne pas présumer que ça passe.

## Origine
Outil `vercel-labs/portless` (la plomberie : proxy 443 + `*.localhost` + CA WSL/Windows +
noms de worktree). Le câblage/la correction par projet = à nous. Réalise l'idée « agent
portless » du plan (cf. mémoire, `CHALLENGE.md`).
