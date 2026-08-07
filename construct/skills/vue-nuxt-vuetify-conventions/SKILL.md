---
name: vue-nuxt-vuetify-conventions
description: Use quand on code un composant, une page ou un composable sur la stack Vue 3/Nuxt/Vuetify — applique les conventions Composition API pures, les patterns d'hydratation Nuxt, les patterns Vuetify (utilitaires, catalogue de composants), la correctness réactivité/sécurité type vue-doctor/nuxt-doctor, et les patterns de review Xefi récurrents. Fusionne ces familles de conventions de la même stack en une seule brique de l'étape code.
---

# vue-nuxt-vuetify-conventions

Étape 6 du pipeline (`WORKFLOW.md`). Cadre l'écriture de code front sur la stack Vue 3 +
Nuxt + Vuetify : trois familles de règles (Vue, Nuxt, Vuetify) qui se recoupent parce que
c'est toujours la même stack et la même étape — une seule brique plutôt que trois qui se
marchent dessus.

## Quand
Dès qu'on écrit ou modifie un composant `.vue`, une page Nuxt, un composable, ou qu'on
choisit un composant Vuetify pour un besoin d'UI, pendant `code` (6) ou `tdd` (5).

## Étapes

### 1. Vue 3 — Composition API pure
1. `<script setup lang="ts">` obligatoire. Jamais d'Options API, jamais de JS non typé.
2. Props/emits/model via macros uniquement : `defineProps<T>()`, `defineEmits<T>()`,
   `defineModel<T>()`. Pas de `props: {}` en objet runtime si le typage suffit.
3. `shallowRef` par défaut pour tout état non-primitif (objets, tableaux, refs DOM lourdes).
   `ref` profond seulement si la réactivité imbriquée est réellement consommée.
4. Ne jamais déstructurer un objet `props` réactif directement (`const { foo } = props` casse
   la réactivité). Accéder via `props.foo`, ou passer par `toRefs(props)` / `computed`.
5. Un composable retourne des `ref`/`computed`, jamais des valeurs brutes. S'il reçoit un
   paramètre qui peut être une valeur ou une ref, le lire avec `toValue()` — jamais
   `unref()` seul (pas de support des getters).

### 2. Nuxt — sécurité d'hydratation et choix de fetch
1. **Jamais** de `Date.now()`, `Math.random()`, ou tout accès `window`/`document` direct au
   niveau du `setup()` synchrone : ça diverge entre le rendu serveur et le rendu client
   (mismatch d'hydratation). Isoler ce genre de valeur dans `onMounted`, derrière
   `import.meta.client`, ou dans `<ClientOnly>`.
2. Choix de la primitive de données selon le besoin :
   - `useFetch` : appel simple lié au cycle de vie du composant, cache/dédup automatique.
   - `useAsyncData` : logique de transformation/agrégation avant retour, ou plusieurs
     sources combinées.
   - `$fetch` : appel impératif hors cycle de rendu (submit de formulaire, action utilisateur).
   - `useState` : état partagé SSR-safe entre composants (pas un `ref` global classique).
   - `useCookie` : état qui doit survivre au reload et être lu côté serveur.
   - `useRequestFetch` : appel serveur qui doit forwarder les headers/cookies de la requête
     entrante (SSR vers une API interne authentifiée).
3. `routeRules` (`nuxt.config`) pour arbitrer le rendu par route (`ssr: false`, `prerender`,
   `swr`, cache) plutôt que du conditionnel dans chaque page.
4. Hydratation paresseuse (`<Lazy...>` ou `hydrate-on-visible`/`hydrate-on-interaction` quand
   Nuxt les expose) pour tout composant lourd hors du viewport initial.
5. **Checklist de revue avant de merger une page/composant Nuxt** :
   - [ ] aucune valeur non déterministe générée en dehors d'un hook client
   - [ ] la primitive de fetch choisie correspond au besoin (pas de `useFetch` partout par
     réflexe)
   - [ ] pas de fuite de données entre requêtes via un état module-level partagé
   - [ ] `routeRules` posé si la page a un besoin de rendu différent du défaut

### 3. Vuetify — composant selon le besoin et classes utilitaires
1. Tableau besoin → composant (aller au plus spécifique, jamais un `<div>` custom si
   Vuetify a déjà le composant) :

   | Besoin | Composant Vuetify |
   |---|---|
   | Liste triable/filtrable de lignes | `VDataTable` (server-side si pagination back) |
   | Formulaire + validation | `VForm` + `VTextField`/`VSelect` + règles |
   | Confirmation/édition ponctuelle | `VDialog` |
   | Panneau latéral contextuel | `VNavigationDrawer` |
   | Notification transitoire | `VSnackbar` |
   | Statut/étiquette | `VChip` |
   | Métrique en un coup d'œil | `VCard` + `VSparkline`/`VProgressLinear` |
2. Espacement et visibilité : toujours les classes utilitaires Vuetify (`ma-*`, `pa-*`,
   `d-*`, `bg-*`, `cursor-not-allowed`, `opacity-0`…`opacity-100`) plutôt qu'un `<style>`
   scoped custom. Un style scoped pour un simple padding/marge/couleur de fond est un
   signal de review.
3. Dans un slot `#item` de `VDataTable`/`VAutocomplete`/`VSelect`, l'objet exposé est le
   `ListItem` interne : toujours lire la donnée via `item.raw`, jamais `item` directement.
4. Mini-catalogue de patterns d'assemblage :
   - **Dashboard** : grille de `VCard` (une métrique par carte) + zone de filtres commune
     au-dessus, tous les compteurs scopés sur le même filtre actif.
   - **CRUD + dialog** : `VDataTable` (liste) + un seul `VDialog` réutilisé pour
     create/edit, état `mode: 'create' | 'edit'` piloté par composable.
   - **Liste** : `VDataTable` server-side dès que la pagination/tri doit taper le back ;
     `v-for` + `VCard` seulement pour une liste courte non paginée.
   - **Form-detail** : `VForm` en lecture seule togglée en édition (pas deux composants
     séparés), validation avant `submit`.
   - **Login** : `VForm` + `VTextField` type password avec toggle visibilité, erreurs
     inline sous le champ concerné (pas de `VSnackbar` pour une erreur de champ).

### 4. Correctness réactivité/hydratation et sécurité (vue-doctor/nuxt-doctor)
Règles déterministes reprises du scanner `geoql/doctor` (packages `oxlint-plugin-vue-doctor` /
`oxlint-plugin-nuxt-doctor`, lui-même explicitement inspiré de `react-doctor` mais verrouillé
sur Vue 3 + Nuxt 4 — donc directement applicable à cette stack, sans filtrage de framework
niche à faire comme côté React).

**Réactivité et composition, la faute la plus fréquente** :
1. `defineStore()` s'appelle une seule fois au niveau module, jamais à l'intérieur d'un
   `setup()`/composable/corps de fonction — sinon chaque appel recrée une définition de store
   au lieu de réutiliser le singleton partagé. Le `useXxxStore()` retourné, lui, s'appelle
   normalement dans `setup()`.
2. N'invoque jamais un prop callback (`props.onXxx()`) pendant le corps du `setup()` ou dans
   un getter `computed` — c'est un effet de bord sur le chemin de rendu, rejoué à chaque
   ré-évaluation et pendant le SSR. Direction : event handler, `watch`, ou lifecycle hook.
3. Un `watch`/`watchEffect` qui enregistre un listener/timer/observer (`addEventListener`,
   `setInterval`/`setTimeout`, `IntersectionObserver`/`MutationObserver`/`ResizeObserver`,
   `WebSocket`/`EventSource`/`BroadcastChannel`) doit avoir son cleanup exact en retour ou via
   `onWatcherCleanup` — même règle que côté React (section correspondante de
   `react-nextjs-conventions`) : ce qui est ajouté doit être explicitement retiré.

**Nuxt — hydratation, la deuxième faute la plus fréquente** :
4. Aucun accès direct à `window`/`document`/`navigator`/`localStorage`/`sessionStorage` au
   niveau racine d'un `<script setup>` : ça crash côté serveur (ces globals n'existent pas
   côté SSR). Guard avec `import.meta.client` (ou `process.client`) ou déplacer dans
   `onMounted`.
5. Même règle dans un getter `computed` : un `computed` s'évalue aussi côté serveur, donc lire
   un global navigateur dedans crash ou produit un mismatch d'hydratation au lieu d'attendre
   le montage client.
6. `useAsyncData`/`useFetch` appelés dans une boucle sans clé string explicite en premier
   argument provoquent des requêtes dupliquées et une fragmentation du cache — toujours une
   clé unique passée explicitement à l'intérieur d'une boucle.

**Sécurité, jamais négociable** :
7. Jamais de token d'auth/secret dans `localStorage`/`sessionStorage` — exposé à toute charge
   XSS. Un cookie `HttpOnly`, `Secure`, `SameSite` posé côté serveur est la seule option saine.
8. `eval()`, `new Function()`, et `setTimeout`/`setInterval` avec un argument string sont des
   vecteurs XSS/RCE — remplacer par de la logique explicite, `JSON.parse` pour de la donnée.
9. Affecter `innerHTML`/`outerHTML` injecte du markup non assaini (sink XSS DOM direct) —
   `textContent` pour du texte, ou passer par DOMPurify avant assignation si du HTML est
   réellement nécessaire.

**Nuxt server routes (h3/Nuxt 4)** :
10. `throw new Error()` dans un handler serveur fuit la stack trace et des détails internes —
    `throw createError()` (h3) pour une erreur HTTP propre sans fuite de stack.
11. `readBody()` est le lecteur h3 legacy ; sous Nuxt 4/h3 v2, `readValidatedBody()` parse et
    valide le corps de requête en une seule étape — pas de validation manuelle après coup.
12. Le paramètre `event` d'un `defineEventHandler` doit être typé explicitement
    (`defineEventHandler<H3Event>(...)` ou annotation directe) — un handler non typé perd
    l'autocomplétion et les garde-fous de type sur `event.context`/`event.node`.

### 5. Patterns récurrents de review Xefi (dette qualité observée sur le terrain)
Checklist courte, findings répétés en review front sur cette stack.

1. Booléen préfixé `is`/`has`/`can`/`should`, toujours.
2. Vérifier qu'une prop Vuetify existe vraiment (version du projet) avant de la passer.
3. Libellé i18n dans une liste/config = `computed(() => [...])`, jamais figé au `setup()`.
4. Composable de data-fetching = il porte son `useAsyncData`/`useFetch`, retourne `data`/`refresh`.
5. Interface de réponse/DTO dans `types/index.ts` du module, préfixée `I`, pas locale.
6. Pas de chunking/retry préventif sans contrainte back vérifiée. Notif en boucle = une seule fois.
7. Chercher un composant/composable proche existant avant d'en écrire un nouveau.
8. Alias d'import plutôt que chemin relatif inter-dossiers (si le linter d'archi le résout).
9. Config déclarative dans `config/` dès que N entités quasi identiques sont câblées à la main.
10. Carte de synthèse au-dessus d'un tableau : total recalculé sur les filtres actifs du tableau.
11. Filtre de table : lire la Resource/Model back (id/name/slug) avant d'écrire le `whereIn`/tri.
12. Réponse d'endpoint : statut/type + message humain, pas juste un code HTTP.
13. `.client.vue` : ref DOM via `watch(..., { immediate: true, flush: 'post' })` ; API exposée
    via `emit('ready', api)`, pas `defineExpose`.
14. Switch dark/light : couper les transitions CSS pendant le changement (classe temporaire,
    double `requestAnimationFrame`, guard SSR) pour éviter le flash au refresh.
15. Bouton-icône sans libellé visible = `aria-label` obligatoire. Modal ouverte = focus posé
    dessus et piégé dedans, rendu au déclencheur à la fermeture.
16. Import par défaut d'une lib d'icônes (toute la lib au lieu d'une icône) ou module lourd
    chargé au niveau d'une route peu visitée = alourdit le bundle pour rien — import nommé /
    lazy component.

## Sortie / checkpoint
Code conforme aux cinq sections ci-dessus. Pas de checkpoint dédié : la conformité est
vérifiée par `gate` (7) et `review` (8), au même titre que le reste du code produit à
l'étape `code`/`tdd`.

## Garde-fous
Pas de commentaires dans le code produit. Ne pas réinventer un composant que Vuetify
fournit déjà. Ne pas dupliquer un composable existant avant d'avoir vérifié qu'aucun
composable proche ne couvre déjà le besoin. `technical/` n'importe jamais `functional/` —
si une valeur manque, elle passe en paramètre depuis l'appelant. En cas de doute sur une
règle Nuxt/Vuetify non couverte ici, escalader plutôt que deviner.

## Origine
Idées reprises de : antfu/skills (skills/vue/ — SKILL.md, script-setup-macros.md,
core-new-apis.md, advanced-patterns.md) pour la section Vue ; affaan-m/everything-claude-code
(skills/nuxt4-patterns/SKILL.md) et onmax/nuxt-skills (skills/nuxt/references/nuxt-composables.md,
extrait limité à la discipline useState/useCookie/useRequestFetch) pour la section Nuxt ;
cylixlee/skills (.deprecated/vuetify-4/SKILL.md + references/patterns/) pour la section
Vuetify ; geoql/doctor (packages `oxlint-plugin-vue-doctor`/`oxlint-plugin-nuxt-doctor`,
lui-même inspiré de millionco/react-doctor, verrouillé Vue 3 + Nuxt 4) pour la section
correctness/sécurité ; retours de review internes Xefi (dette qualité récurrente observée sur
plusieurs projets front de la même stack, généralisée et dénominalisée) pour la section
patterns de review ; metabase/metabase (skill `typescript-review` — blind-spots
accessibilité/poids bundle) pour les items 15-16 de cette même section. Mécanismes réécrits,
pas de texte copié.
