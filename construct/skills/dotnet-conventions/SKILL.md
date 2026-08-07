---
name: dotnet-conventions
description: Use quand on code ou revoit du C#/.NET (ASP.NET Core, EF Core) — applique les patterns async/await, IDisposable, injection de dépendances et EF Core les plus à haute valeur des Roslyn analyzers (CAxxxx) et de Meziantou.Analyzer. Pas de vécu de production interne derrière cette brique — contenu sourcé sur l'outillage/guides établis du marché.
---

# dotnet-conventions

Étape 6 du pipeline (`WORKFLOW.md`). Cadre l'écriture et la review de code
C#/.NET. **Statut particulier** : comme `go-conventions`, pas encore de vécu
de production Xefi derrière ce fichier — contenu issu des Roslyn analyzers
(`Microsoft.CodeAnalysis.NetAnalyzers`, activés par défaut depuis .NET 5) et
de Meziantou.Analyzer, pas de retours de review réels. Base solide à
confronter au premier vrai projet .NET, pas une doctrine éprouvée.

## Quand
Dès qu'on écrit ou modifie du code C#/.NET, pendant `code` (6) ou `tdd` (5).

## Étapes

### 1. Async/await — la faute la plus fréquente
1. Jamais `.Result`/`.Wait()`/`.GetAwaiter().GetResult()` dans une méthode
   déjà async (CA1849) — source classique de deadlock sur le contexte de
   synchronisation.
2. `async void` réservé aux event handlers — ailleurs, les exceptions ne sont
   pas catchables et la méthode ne se compose pas avec `await`.
3. Une `Task` jamais `await`-ée ni stockée ("fire-and-forget" implicite) avale
   silencieusement ses exceptions.
4. `ConfigureAwait(false)` dans le code de librairie partagée ; moins
   critique côté ASP.NET Core serveur (pas de contexte de synchro à ce
   niveau), mais à garder explicite plutôt qu'à l'oublier par défaut (CA2007).

### 2. IDisposable et lifecycle
1. Un `IDisposable` créé localement est disposé sur tous les chemins
   (`using`/`using` declaration), y compris les chemins d'exception (CA2000).
2. Pattern `Dispose(bool)` complet avec `GC.SuppressFinalize` si
   `IDisposable` est implémenté à la main (CA1063) — jamais un `Dispose()`
   partiel.
3. `!` (null-forgiving) n'est pas un moyen de faire taire le compilateur sans
   garantie réelle — chaque usage doit être justifiable, pas réflexe. Nullable
   Reference Types activé de façon cohérente sur tout le projet, pas partiel.
4. Une requête LINQ réénumérée plusieurs fois (`multiple enumeration`) sur un
   `IEnumerable` à exécution différée réexécute la requête à chaque itération
   — matérialiser (`.ToList()`) si la source est coûteuse ou a un effet de
   bord (CA1851, angles morts connus : vérifier à l'œil aussi).
5. `catch {}` vide ou `catch (Exception) {}` sans log ni rethrow avale un vrai
   bug — jamais un catch silencieux.

### 3. Injection de dépendances
1. Un service `Scoped` jamais injecté dans un `Singleton` ("captive
   dependency") — il se gèle pour toute la durée de vie de l'app (ex.
   `DbContext` partagé entre requêtes concurrentes).
2. Règle générale de durée de vie : un service ne dépend que d'un service de
   durée de vie égale ou supérieure à la sienne.
3. Un `Singleton`/background worker qui a besoin d'un service scoped passe
   par `IServiceScopeFactory` pour créer un scope manuel — jamais une
   injection directe du service scoped.

### 4. ASP.NET Core et EF Core
1. `AsNoTracking()` sur toute requête EF Core en lecture seule — sans ça,
   coût perf mesuré (~2x plus lent à l'échelle) et tracking d'état non désiré.
2. Ordre des middlewares vérifié à l'œil (`UseRouting`/`UseAuthentication`/
   `UseAuthorization`) — pas de règle Roslyn dédiée, erreur de review fréquente
   et sans détection automatique.
3. Minimal API : validation/filtres par endpoint moins visibles qu'en
   Controllers classiques — vérifier explicitement en review qu'ils existent,
   pas supposer qu'ils sont hérités d'ailleurs.

## Sortie / checkpoint
Code conforme aux quatre sections ci-dessus, et build sans nouveau warning
`Microsoft.CodeAnalysis.NetAnalyzers`/Meziantou introduit par le diff.
Vérifié par `gate` (7) et `review` (8).

## Garde-fous
Pas de commentaires dans le code produit. Cette brique n'a pas encore été
confrontée à un vrai projet .NET de production chez Xefi — en cas d'écart
entre une règle ici et un besoin réel observé, corriger cette brique plutôt
que de la traiter comme acquise. Les Framework Design Guidelines (naming
d'API publique) ne sont pertinentes que pour du code de librairie partagée,
pas pour de l'applicatif interne — ne pas les imposer hors de ce contexte.

## Origine
Idées reprises de : Roslyn analyzers `Microsoft.CodeAnalysis.NetAnalyzers`
(règles CA2007, CA1849, CA2000, CA1063, CA1851 citées) ; Meziantou.Analyzer
(async/disposal/culture-invariance) ; documentation EF Core (tracking vs
no-tracking) ; pattern "captive dependency" documenté côté communauté .NET.
Mécanismes réécrits, pas de texte copié. Recherche de marché, pas de retour
de production interne à ce stade.
