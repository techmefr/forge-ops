---
name: react-nextjs-conventions
description: Use quand on code un composant, un hook, un slice Redux ou un écran sur la stack React/Next.js des collègues — applique les patterns de rendering/perf, la structuration Redux Toolkit et la composition shadcn/ui. Fusionne les trois familles de conventions de la même stack en une seule brique de l'étape code, pendant de vue-nuxt-vuetify-conventions.
---

# react-nextjs-conventions

Étape 6 du pipeline (`WORKFLOW.md`). Cadre l'écriture de code sur la stack React 18/19 +
Next.js + Redux Toolkit + shadcn/ui des collègues front. Trois familles de règles qui se
recoupent parce que c'est toujours la même stack et la même étape — une seule brique
plutôt que trois qui se marchent dessus. Complémentaire de `legolas` (agent de review
de diff) : ici on écrit le code, legolas le relit après coup.

## Quand
Dès qu'on écrit ou modifie un composant `.tsx`, une route Next.js, un hook, un slice
Redux Toolkit, ou qu'on compose un composant shadcn/ui, pendant `code` (6) ou `tdd` (5).

## Étapes

### 1. Rendering et perf
1. Paralléliser les fetch indépendants avec `Promise.all` (Server Components) plutôt que
   les enchaîner en séquence — un `await` après l'autre crée une waterfall réseau invisible
   à la lecture du composant.
2. Dériver l'état au render plutôt qu'un `useEffect` + `setState` redondant. Si une valeur
   se calcule à partir de props/state existants, c'est une variable locale ou un `useMemo`,
   jamais un effet qui resynchronise un state parallèle.
3. Ne jamais définir de composant à l'intérieur d'un composant (function déclarée dans le
   corps d'un autre composant) : ça recrée le type à chaque render et démonte/remonte tout
   le sous-arbre, perte de state et de focus incluse. Sortir le composant au niveau module.
4. `setState` fonctionnel (`setCount(c => c + 1)`) dès que la nouvelle valeur dépend de
   l'ancienne, surtout dans un handler qui peut être appelé plusieurs fois avant le
   prochain render (event rapide, effet, callback async).
5. `next/dynamic` pour tout composant lourd non nécessaire au premier paint (éditeur riche,
   graphique, modal complexe) — avec `ssr: false` si le composant dépend du DOM/window.

### 2. Redux Toolkit — structuration
1. Un slice = `createSlice` typé : `initialState` typé explicitement, reducers avec
   `PayloadAction<T>`, jamais de state ou d'action `any`.
2. Hooks typés obligatoires : `useAppDispatch`/`useAppSelector` (wrappers de
   `useDispatch`/`useSelector` sur le `RootState`/`AppDispatch` du store), jamais les hooks
   RTK bruts dans les composants — sinon le typage se reperd à chaque usage.
3. Effet de bord async = `createAsyncThunk` avec `rejectWithValue` sur l'erreur, jamais un
   `throw` nu : le slice doit pouvoir distinguer un rejet métier typé d'une exception
   inattendue dans les reducers `extraReducers`.
4. Sélecteur dérivé (filtre, tri, agrégat) = `createSelector` mémoïsé, jamais un `.filter()`/
   `.map()` recalculé en ligne dans le composant à chaque render.
5. Donnée serveur (fetch, cache, invalidation) : RTK Query plutôt qu'un thunk maison dès que
   le besoin est CRUD standard avec cache — un thunk + slice custom ne se justifie que pour
   une logique métier qui dépasse le cache/invalidation générique.
6. Complément data-fetching : si le projet n'a pas Redux comme couche data serveur (RSC/Next
   pur), TanStack Query couvre le même besoin — cache, dédup, invalidation — avec le même
   principe que la section 1.2 : minimiser `useEffect`/`useState` manuels pour de la donnée
   serveur, laisser la lib gérer le cycle de vie de la requête.

### 3. shadcn/ui — composition
1. Philosophie copy-and-own : les fichiers dans `components/ui` sont générés une fois puis
   possédés par le projet, pas une dépendance versionnée qu'on met à jour depuis l'extérieur.
2. Étendre un composant shadcn par wrapper (nouveau composant qui compose le composant
   généré), jamais en modifiant directement le fichier généré dans `components/ui` — sinon
   toute regénération ou tout autre usage du composant de base hérite de la déviation.
3. `cn()` (helper `clsx` + `tailwind-merge`) comme unique point de fusion de classes
   Tailwind : jamais de concaténation de string de classes à la main, jamais deux sources de
   classes conditionnelles différentes sur le même composant.
4. Structure de dossiers : `components/ui` (composants générés, non modifiés en place),
   `components/` (wrappers métier au-dessus), `lib/` (`cn()` et utilitaires), `hooks/`
   (hooks partagés), providers au plus près de la racine (`app/providers.tsx` ou
   équivalent) — pas de composant métier qui vit à plat dans `components/ui`.

### 4. Correctness effects/state et sécurité (react-doctor)
Checklist courte, sous-ensemble sévérité `error` du scanner `react-doctor` pertinent à cette
stack (React/Next core, pas Ink/Remotion/R3F/shaders/React Native/React Router).

**Effects et state** :
1. Cleanup d'effet = même référence retirée que celle ajoutée (`addEventListener`, `observer.disconnect()`, `clearInterval`/`clearTimeout`, `unsubscribe()`), jamais une fonction inline recréée.
2. Jamais de prop callback / mutation de ref / `Context`/store créé / navigation pendant le rendu — ça va dans un handler ou un `useEffect`. Un `Context`/store se crée au niveau module.
3. Un reducer retourne un nouvel objet, ne mute jamais son state en place.
4. Clé de liste = id stable de l'item, jamais `Math.random()`/`Date.now()`/index si l'ordre change.
5. Dep d'effet réactive : pas de `ref.current`/`location.pathname` en dep, les lire dans le corps.
6. Objet/tableau/fonction recréé à chaque render et utilisé en dep/prop mémoïsée → `useMemo`/`useCallback`/constante de module.

**Next.js App Router** :
7. `cookies()`/`headers()`/`draftMode()`/`params`/`searchParams` : toujours `await` (Next 15+).
8. Error boundary = Client Component (`'use client'`). `global-error.tsx` englobe `<html><body>`.
9. `route.ts` exporte des handlers nommés (`GET`, `POST`...), jamais `export default`.
10. `next/head` ignoré dans l'App Router — passer par l'API `Metadata`.
11. Pas d'état mutable au niveau module côté serveur (`let`/`var` hors fonction) — partagé entre requêtes concurrentes.
12. Une Server Action exportée est appelable par un client non authentifié — elle vérifie l'auth elle-même.

**Sécurité, jamais négociable** :
13. Aucun secret commité — s'il l'est, retiré ET tourné, pas juste supprimé du prochain commit.
14. Pas de fallback littéral en dur sur une variable d'env secrète — fail closed.
15. `eval()`/`new Function()` sur une chaîne non fiable interdit — `JSON.parse` pour de la donnée.
16. JWT : épingler l'algorithme attendu (`{ algorithms: ['RS256'] }`), jamais accepter `none`.
17. Commande shell : jamais d'interpolation, arguments en tableau, allowlist stricte.
18. Handler `GET` sans effet de bord (préchargé/prefetché) — mutation = `POST`.

**Accessibilité et poids bundle** :
19. Jamais bloquer le paste sur un champ d'authentification (mot de passe, code).
20. Jamais désactiver le zoom viewport — si le layout casse à 200%, le layout est le problème.
21. Bouton-icône sans libellé visible = `aria-label` obligatoire. Modal ouverte = focus posé
    dessus et piégé dedans, rendu au déclencheur à la fermeture.
22. Import par défaut d'une lib d'icônes ou module lourd chargé au niveau d'une route peu
    visitée = alourdit le bundle pour rien — import nommé / `next/dynamic`.

## Sortie / checkpoint
Code conforme aux trois sections ci-dessus. Pas de checkpoint dédié : la conformité est
vérifiée par `gate` (7) et par `legolas` en review à l'étape `review` (8).

## Garde-fous
Pas de commentaires dans le code produit. Ne jamais modifier un fichier généré dans
`components/ui` en place — toujours passer par un wrapper. Ne pas dupliquer un hook ou un
sélecteur existant avant d'avoir vérifié qu'aucun hook/sélecteur proche ne couvre déjà le
besoin. Cette brique écrit du code, elle ne fait pas de review de diff — pour la review,
c'est `legolas`. En cas de doute sur une règle Redux/shadcn non couverte ici, escalader
plutôt que deviner.

## Origine
Idées reprises de : vercel-labs/agent-skills (skill react-best-practices, AGENTS.md — patterns
perf/rendering/waterfalls avec exemples avant/après) pour la section rendering/perf ;
Mindrally/skills (redux-toolkit/SKILL.md — createSlice typé, hooks typés, createAsyncThunk,
sélecteurs mémoïsés) pour la section Redux Toolkit ; velcrafting/codex-skills
(skills/shadcn/SKILL.md — composition par wrapper, cn(), structure de dossiers, new-york/
sonner/React 19) pour la section shadcn/ui ; millionco/react-doctor (package
`oxlint-plugin-react-doctor`, registre de ~780 règles déterministes, sous-ensemble sévérité
`error` filtré et pertinent hors frameworks niches) pour la section correctness/sécurité ;
metabase/metabase (skill `typescript-review` — blind-spots accessibilité/poids bundle) pour
les items 21-22. Mécanismes réécrits, pas de texte copié.
