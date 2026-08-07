---
name: go-conventions
description: Use quand on code ou revoit du Go — applique les patterns de concurrence, gestion d'erreurs et contexte les plus à haute valeur du méta-linter golangci-lint (govet/staticcheck/errcheck) et de l'Uber Go Style Guide. Pas de vécu de production interne derrière cette brique (contrairement à vue-nuxt-vuetify-conventions/react-nextjs-conventions) — contenu sourcé sur l'outillage/style guides établis du marché.
---

# go-conventions

Étape 6 du pipeline (`WORKFLOW.md`). Cadre l'écriture et la review de code Go.
**Statut particulier** : contrairement aux briques front (vue-nuxt-vuetify,
react-nextjs), il n'y a pas encore de vécu de production Xefi derrière ce
fichier — le contenu vient de l'outillage déterministe (golangci-lint,
staticcheck, govet) et des style guides établis (Uber), pas de retours de
review réels. À traiter comme une base solide à confronter au premier vrai
projet Go, pas comme une doctrine éprouvée.

## Quand
Dès qu'on écrit ou modifie du code Go, pendant `code` (6) ou `tdd` (5).

## Étapes

### 1. Concurrence et goroutines — la faute la plus fréquente
1. Toute goroutine lancée a un mécanisme d'arrêt explicite (`context`,
   `WaitGroup`, ou channel `done`) — une goroutine sans porte de sortie fuit
   silencieusement à chaque appel.
2. `sync.Mutex`/`sync.RWMutex` jamais copié par valeur (y compris via un
   struct qui l'embarque) — la zéro-valeur est valide, ne jamais l'initialiser
   ni passer un pointeur par réflexe.
3. Fermeture dans une boucle qui capture la variable de boucle par référence
   (bug classique en Go < 1.22, encore présent sur du code legacy) — vérifier
   la version du module avant de juger ce point non applicable.
4. `cancel` renvoyé par `context.WithCancel`/`WithTimeout` toujours appelé
   (souvent en `defer`) — sinon fuite de contexte.
5. Accès concurrent à une map sans mutex ni `sync.Map` panique au runtime
   ("concurrent map read and map write"), non détecté statiquement.

### 2. Error handling
1. Aucune erreur de retour ignorée sans `_` explicite ni traitement.
2. `errors.Is`/`errors.As` plutôt que comparaison directe (`err == SomeErr`)
   ou assertion de type directe — casse dès qu'une erreur est wrappée.
3. `%w` pour wrapper une erreur (préserve la chaîne pour `errors.Is`/`As`),
   `%v` seulement si l'obfuscation est un choix assumé, pas un défaut.
4. Un `recover()` qui avale l'erreur sans la relancer ni la logger masque un
   vrai bug — jamais un `recover` silencieux.

### 3. Contexte
1. `context.Context` toujours premier paramètre, jamais stocké dans un struct.
2. Une fonction propage le contexte reçu en paramètre, jamais
   `context.Background()` recréé en profondeur — sinon annulation/timeout du
   niveau supérieur ignorés.
3. Requête HTTP toujours avec contexte (`http.NewRequestWithContext`), jamais
   `http.Get` nu.

### 4. Autres correctness
1. `resp.Body` d'une réponse HTTP toujours fermé (`defer resp.Body.Close()`)
   — sinon fuite de connexions.
2. `defer` dans une boucle accumule jusqu'à la fin de la fonction, pas de
   l'itération — épuisement de ressources (fichiers, locks) sur boucle longue.
3. Variable `err` redéclarée avec `:=` qui masque l'erreur d'un scope parent
   — vérifier qu'aucune erreur du scope externe n'est silencieusement perdue.
4. `interface{}`/`any` comme fourre-tout pour éviter de typer correctement —
   préférer generics ou un type concret.
5. Slice/map reçus ou retournés aux frontières d'API = référence vers les
   données de l'appelant, mutable à son insu — copier si l'isolation est
   nécessaire.

## Sortie / checkpoint
Code conforme aux quatre sections ci-dessus, et `golangci-lint run` (config
par défaut : errcheck, govet, staticcheck, gosimple, ineffassign, unused, plus
`contextcheck`/`bodyclose`/`noctx` si activés) sans nouveau finding introduit
par le diff. Vérifié par `gate` (7) et `review` (8).

## Garde-fous
Pas de commentaires dans le code produit. Ne pas activer `shadow` (govet) par
défaut — bruyant, seulement si le projet le veut explicitement. Cette brique
n'a pas encore été confrontée à un vrai projet Go de production chez Xefi —
en cas d'écart entre une règle ici et un besoin réel observé, corriger cette
brique plutôt que de la traiter comme acquise.

## Origine
Idées reprises de : golangci-lint (méta-linter, catégories par défaut
errcheck/govet/staticcheck/gosimple/ineffassign/unused) ; staticcheck.dev
(règles SA/S/ST citées) ; uber-go/guide (Uber Go Style Guide — copie de
slices/maps aux frontières, defer pour les ressources, éviter `interface{}`
fourre-tout). Mécanismes réécrits, pas de texte copié. Recherche de marché,
pas de retour de production interne à ce stade.
