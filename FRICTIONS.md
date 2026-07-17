# Frictions terrain — ce que starfleet (+ setup portless) doit résoudre

Cas réels vécus en dev local. Sert de motivation et de banc d'essai : chaque friction
est mappée à « dans le périmètre starfleet / portless / source de vérité unique » ou « hors
scope, à traiter ailleurs ».

## Cas 1 — feature front CRM sur skera-front-web (WSL Ubuntu + Docker)

**Contexte.** Dev/test local d'une feature front (produits CRM) sur `skera-front-web`, avec
`skera-api` (Laravel/Sail) et `formation-laravel` en parallèle. D'autres stacks ont tourné
(nexeren, pilota, platform-api). Objectif simple — voir la page et se connecter — qui a
demandé énormément de contournements manuels.

| # | Friction | Cause | Scope |
|---|---|---|---|
| 1 | `git pull` impossible : pas d'entrée SSH pour `gitlab.skera.com`, passphrase oubliée | secrets / onboarding | **hors scope** |
| 2 | Front 250 commits de retard (archi `layers/` → `functional/`), back 62 | dérive local ↔ remote | **hors scope** (mise à niveau) |
| 3 | Node 18 au lieu de 24, token FontAwesome expiré, token npm global invalide | toolchain non reproductible | **hors scope** (env/deps) |
| 4 | Ports en collision : rustfs `9001` vs MinIO formation `9001` ; back `8282→:80` incohérent ; front `3000` vs port attendu par le callback. Résolu à la main (formation en `19xxx`, rustfs console `9101`) | collision de ports hôte | **✅ dans le périmètre** |
| 5 | Env front↔back désalignés : URLs sur mauvais port (`8282` vs `80`), `NUXT_BACKEND_URL` sur `localhost` au lieu du hostname docker, `FRONT_END_URL` back resté sur la prod. Resync manuelle à chaque changement de port | pas de source de vérité ports/URLs | **✅ dans le périmètre** |
| 6 | `migrate:fresh --seed` échoue (conflit alias Elasticsearch : index créé au nom de l'alias) → tables manquantes (`features`, `notifications`), back 500 | seed DB/ES non reproductible | **hors scope** |
| 7 | Auth non testable : vrai SSO Microsoft, callback KO (« already redeemed » + 500). Contournement token-en-cookie OK mais bloqué par la DB | auth / env | **hors scope** |
| 8 | État instable entre sessions : conteneurs qui tombent, dev server front pas relancé dans le conteneur, process tués aux redémarrages | état non persistant | **✅ partiellement** (état centralisé) |

**Ce que portless + source de vérité unique éliminent à la racine :** #4 et #5.
Domaines fixes via reverse-proxy (zéro port hôte publié) → plus de juggling de ports (#4) ;
source de vérité unique ports/URLs (starfleet) → plus de resync manuelle front/back (#5) ;
état centralisé → #8 en partie.

**Ce qui reste hors scope (à traiter ailleurs) :** onboarding/secrets (#1), mise à niveau
(#2), toolchain reproductible (#3), seed DB/ES (#6), auth locale (#7). À noter pour une
future brique « setup / onboarding », distincte de l'orchestration.

## Cas déjà notés (rappel)

- Deux projets (formation + stacktim) avec le même port back → bloqué. **✅ réglé** par la clé (projet+branche) + unicité globale des ports.
- Vieux projet relancé qui collisionne → chasse manuelle de ports. **✅ visé** (allocation consciente des ports occupés, à finir).
- Un dev fait deux worktrees pour une tâche similaire → doublons. **partiel** (identité de tâche + état partagé équipe/FLEET).
- Code commun dupliqué entre tâches isolées. **visé** par la méthodo (check archi au plan) + graphify.

## Conclusion

Le cœur récurrent : **collisions de ports hôte + désalignement des URLs + état non partagé**.
La cible = **portless** (domaines fixes via reverse-proxy, aucun port hôte publié) **+ source
de vérité unique** (starfleet gère domaines/URLs/état). C'est ce qui tue #4/#5/#8 à la source.
