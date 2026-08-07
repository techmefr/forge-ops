---
name: nestjs-node-conventions
description: Use quand on code un module, un controller, un service ou un router tRPC sur la stack NestJS/Node de la vision HeryJs — applique l'architecture DI par constructeur, les DTO validés, les contrats Zod/tRPC transverses et le repository pattern Prisma. Fusionne les conventions Nest, Prisma, tRPC et Zod (même stack, même étape) en une seule brique de l'étape code.
---

# nestjs-node-conventions

Étape 6 du pipeline (`WORKFLOW.md`). Première brique construct pour le backend Node —
aucune n'existait avant, pertinente pour la vision HeryJs (NestJS + Prisma + tRPC). Cadre
l'écriture de code sur cette stack : architecture Nest, contrats de validation, contrats
type-safe transverses attendus par tRPC, et accès données Prisma — quatre familles de
règles qui se recoupent parce que c'est toujours la même stack et la même étape, une seule
brique plutôt qu'une par librairie.

## Quand
Dès qu'on écrit ou modifie un module Nest, un controller, un service, un DTO, un router ou
une procedure tRPC, ou un repository Prisma, pendant `code` (6) ou `tdd` (5).

## Étapes

### 1. NestJS — architecture module/controller/service
1. Un module par domaine métier (`UsersModule`, `OrdersModule`...), déclaré avec ses
   `providers`/`controllers`/`exports` explicites. Pas de logique métier dans le module
   lui-même.
2. Le controller ne fait que router et sérialiser : il reçoit le DTO validé, appelle le
   service, retourne le résultat. Aucune règle métier, aucun accès Prisma direct dans un
   controller.
3. Injection de dépendances par constructeur uniquement (`constructor(private readonly
   usersService: UsersService) {}`). Jamais de `new Service()` : ça casse le cycle de vie
   Nest et le graphe de DI devient invérifiable.
4. `forwardRef()` en dernier recours seulement, quand une dépendance circulaire entre deux
   modules est réellement inévitable. Avant d'y recourir, vérifier qu'un découpage de
   module ne supprime pas le cycle.
5. Tests via `Test.createTestingModule({...}).compile()` — jamais d'instanciation manuelle
   de service dans un test unitaire, pour garder le même graphe de DI qu'en prod (mocks des
   providers injectés, pas du service testé).

### 2. DTO et validation — frontière HTTP
1. Un DTO par forme d'entrée (`CreateUserDto`, `UpdateUserDto`), décoré `class-validator`
   (`@IsString()`, `@IsEmail()`, `@IsOptional()`...). Jamais de `any` ou d'objet non typé en
   paramètre de controller.
2. `ValidationPipe` global (`app.useGlobalPipes(new ValidationPipe({ whitelist: true,
   forbidNonWhitelisted: true }))`) plutôt qu'un pipe posé route par route.
3. Les exceptions HTTP typées (`NotFoundException`, `ConflictException`,
   `BadRequestException`...) sont levées côté service, jamais côté controller — le service
   connaît la règle métier qui justifie le statut, le controller non.

### 3. Contrats type-safe transverses (Zod + tRPC)
1. Aux frontières où le contrat doit être partagé avec un client type-safe (tRPC), dériver
   le type depuis le schéma de validation avec `z.infer<typeof schema>` plutôt que
   maintenir une interface TypeScript en parallèle du schéma Zod — une seule source de
   vérité, jamais deux définitions qui peuvent diverger.
2. Réponses d'API hétérogènes (succès/erreur, plusieurs variantes de résultat) modélisées
   en union discriminée (`{ status: 'ok', data } | { status: 'error', message }`) avec un
   champ discriminant explicite, jamais un objet à champs optionnels que l'appelant doit
   deviner.
3. Arborescence tRPC organisée par domaine métier, symétrique aux modules Nest : un router
   par domaine (`usersRouter`, `ordersRouter`), composé dans un `appRouter` racine ;
   chaque procedure (`query`/`mutation`) valide son input avec un schéma Zod passé à
   `.input()`.
4. Le schéma Zod de la procedure et le DTO `class-validator` du controller REST équivalent
   décrivent la même forme de données : en cas de double exposition (REST + tRPC) d'un même
   cas d'usage, vérifier qu'ils ne divergent pas silencieusement plutôt que les laisser
   évoluer indépendamment.

### 4. Prisma — schema, migrations, accès données
1. Un repository par agrégat métier (`UsersRepository`), injecté dans le service comme
   n'importe quel provider Nest — le service ne connaît jamais `PrismaClient` directement,
   seulement le repository.
2. Toute évolution de `schema.prisma` passe par une migration (`prisma migrate dev`)
   commitée, jamais par une modification manuelle du schéma en base.
3. Opérations type-safe : s'appuyer sur les types générés par Prisma (`Prisma.UserCreateInput`,
   `Prisma.UserWhereInput`...) plutôt que retyper à la main les entrées/sorties d'une query.
4. Mapped types Prisma (`Prisma.UserGetPayload<{ include: {...} }>`) pour typer précisément
   le résultat d'une query avec relations, plutôt qu'un type maison approximatif ou un
   `any` sur le retour du repository.
5. Type guards sur les modèles quand une relation est optionnelle (`include` conditionnel) :
   vérifier la présence de la relation avant de la lire, jamais un cast qui masque le cas
   `undefined`.
6. Pour tout point d'intégration Prisma non couvert ici (stratégies de transaction,
   middleware, seed, connexions multiples...), se référer à la documentation officielle
   Prisma plutôt que deviner — les sources de cette brique ne détaillent l'ORM que côté
   TypeORM, pas Prisma.

## Sortie / checkpoint
Code conforme aux quatre sections ci-dessus. Pas de checkpoint dédié : la conformité est
vérifiée par `gate` (7) et `review` (8), au même titre que le reste du code produit à
l'étape `code`/`tdd`.

## Garde-fous
Pas de commentaires dans le code produit. Jamais de `new Service()` : la DI passe toujours
par le constructeur. `forwardRef()` en dernier recours, pas en réflexe face à une erreur de
dépendance circulaire. Jamais de logique métier dans un controller ou un router tRPC. Pas
de double définition de type là où `z.infer` peut dériver le type depuis le schéma. Ne pas
réimplémenter un mécanisme que Nest, Prisma ou tRPC fournissent déjà. En cas de doute sur
l'intégration Prisma non couverte ici, consulter la doc officielle plutôt que deviner.

## Origine
Idées reprises de : Jeffallan/claude-skills (skills/nestjs-expert/SKILL.md) pour
l'architecture module/controller/service, la DI par constructeur, les DTO
`class-validator`, les exceptions HTTP et les tests `Test.createTestingModule` ;
SpillwaveSolutions/mastering-typescript-skill pour les contrats Zod/`z.infer`, les unions
discriminées et les mapped types/type guards sur les modèles Prisma ; mindrally/skills
(prisma-development/SKILL.md pour le schema/migrations/opérations type-safe, trpc/SKILL.md
pour l'arborescence routers/procedures, zod-schema-validation/SKILL.md pour la validation
aux frontières). Mécanismes réécrits, pas de texte copié.
