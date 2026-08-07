# construct — carte du savoir (références)

> « Voir tous les `.md` qu'il faut » pour extraire, améliorer, accélérer, maintenir.
> **Discipline (règle B appliquée aux docs) : une seule source par sujet.** Un doc de référence
> soit **tient** une connaissance qui n'a pas de home, soit **indexe** une source existante —
> **jamais une copie**. Les briques (`skills`) et agents *pointent* vers ces sources, ne les
> réexpliquent pas. Publiable/Interne suit la règle C (`CONVENTIONS.md`).

## La carte

| Sujet | Source unique de vérité | Type | Pub/Int | Statut |
|---|---|---|---|---|
| Méthode / pipeline | `construct/WORKFLOW.md` | doc | Pub | ✅ |
| Gouvernance + gabarit | `construct/CONVENTIONS.md` | doc | Pub | ✅ |
| Registre briques + backlog | `construct/CATALOG.md` | doc | Int* | ✅ |
| Veille à trier | `construct/SOURCING-INBOX.md` | doc | Int | ✅ |
| Comparatif veille | `VEILLE.md` (racine) | doc | **Int** | ✅ |
| Réalité infra / ports / SSO | `CHALLENGE.md`, `FRICTIONS.md` (racine) | doc | **Int** | ✅ |
| **Design system** (grille 4px, spacing, chips, boutons, conteneurs, icônes, ux-writing) | plugin `xefi-claude-skills` → skills `design:*` | skills | Pub | ✅ (indexer) |
| **Accessibilité RGAA** | skill `design:accessibility` | skill | Pub | ✅ (indexer) |
| **Testing** (test-casebook : data-test-*, persona matrix, ≥90% ; env-attr-cleaner) | repo `test-casebook` + `doctrine-test-back-laravel-lomkit.md` | repo/doc | Pub | ✅ (indexer) |
| **Conventions front** (Nuxt/Vue/Vuetify : shorthand props, booléens is/has, i18n en computed, pas de prop Vuetify inexistante) | *éparses en mémoire* | — | Pub (générique) | 🔜 **à écrire** `conventions-front.md` |
| **Conventions back** (Laravel/lomkit : filters au max, réponses status+message, simplicité > nb d'appels) | `doctrine-test-back-laravel-lomkit.md` + mémoire | doc/— | Pub (générique) | 🔜 **à écrire** `conventions-back.md` (pointe doctrine) |
| **Git / commits / MR** (conventional, minuscule ; commentaires MR sans emojis, courts) | *éparses en mémoire* | — | Pub | 🔜 **à écrire** `git-mr.md` |
| **Code smells** (baseline citée par `review` axe Standards) | à formaliser | — | Pub | 🔜 **à écrire** `code-smells.md` |
| Agents (aragorn/gimli/legolas/valerianus/gandalf…) | `.claude/agents/*` | defs | Int | ✅ (registre dans CATALOG) |

\* `CATALOG.md` : la structure est publiable, mais son backlog nomme des repos/couches internes → garder interne tant qu'on n'a pas séparé.

## Règles d'usage
- **Ne pas dupliquer** : si un sujet a déjà une skill (design, testing), on **pointe**, on ne
  recopie pas. Une skill qui aurait besoin d'un chiffre le lit dans la source, pas en dur.
- **Combler un manque = un seul doc** ici, cité par toutes les briques concernées.
- **Publiable** (Pub) → peut vivre dans un futur repo public ; **Interne** (Int) → jamais.
  Un doc « Pub (générique) » ne cite **aucun** nom de projet/collègue réel (règle C).

## À écrire (manques réels, dans l'ordre d'utilité)
1. `conventions-front.md` — cité par `review` et `code` (le plus sollicité).
2. `git-mr.md` — cité par `ship` et `review`.
3. `conventions-back.md` — pointe `doctrine-test-back-laravel-lomkit.md`, consolide le reste.
4. `code-smells.md` — cité par `review` (axe Standards).

**Ces docs se sèment automatiquement** : la brique `extract-conventions` lit le code réel et
produit un brouillon `references/observed/<projet>.md` (interne) ; la version publiable
générique en est la distillation humaine. Écrire à la main = le fallback, pas le défaut.
