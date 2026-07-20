# construct — conventions d'écriture des briques

> Gouvernance de toutes les briques du workflow (skills, commands, agents, tools).
> Deux règles fondatrices, puis le **gabarit unique** d'écriture.

## Règle A — tester l'approche complète d'abord

On assemble le **pipeline entier** (étapes 1→11 de `WORKFLOW.md`) et on fait passer **une vraie
feature de bout en bout** avant de découper en projets (construct / starfleet / FLEET / …). Le
découpage vient *après*, une fois que l'approche complète est validée sur le terrain. Tant que
le tour complet n'a pas tourné une fois, on ne fige aucune frontière de projet.

## Règle B — réécrire « à notre sauce », jamais dépendre

Toute brique venue de l'extérieur (skill, agent, technique, outil) est **réécrite en interne**,
jamais branchée en dépendance runtime sur un repo tiers.

**Pourquoi :**
- **Personne en amont ne peut modifier ou casser notre workflow** (pas de drift, pas de
  `npx skills add` qui change de comportement du jour au lendemain).
- **Auditable** : on sait exactement ce que chaque brique fait, c'est notre code/nos mots.
- **Maintenable** : *tout est écrit de la même façon* → un dev qui connaît une brique les
  connaît toutes.

**On garde l'idée, pas le paquet.** On lit la source, on extrait le mécanisme, on le réécrit
dans le gabarit ci-dessous, et on **crédite l'origine** (section `Origine`). On ne copie pas le
texte ; on réimplémente le principe.

### Checklist d'adoption d'une brique externe
1. Lire la source, isoler **le mécanisme** (pas la prose).
2. Vérifier qu'aucune brique interne ne le couvre déjà (sinon : étendre, pas dupliquer).
3. Réécrire dans le **gabarit unique** (ci-dessous), voix Xefi, en français.
4. Renseigner `Origine` (d'où vient l'idée, honnêtement).
5. **Zéro install externe** : la brique vit dans notre repo. Aucune dépendance réseau.

## Règle C — construct reste publiable

`construct/` est conçu pour être **extrait un jour dans un repo public** (« superpowers version
Xefi », comme obra/mattpocock/addyosmani). Pour que ce soit un simple copier-coller le moment
venu, on tient la frontière **dès l'écriture** :

- **Dans `construct/` (générique, publiable)** : pipeline, skills, gabarit, conventions, agents
  génériques. Aucun secret, aucun nom de vrai projet, aucune réalité infra.
- **Hors `construct/` (interne, privé)** : noms de projets réels (skera, nexeren…), infra
  (ports, SSO, hosts, noms de serveurs DB), `CHALLENGE.md` / `FRICTIONS.md` / `VEILLE.md`,
  la mémoire. Une brique **n'y fait jamais référence en dur** — elle nomme un rôle (« le back »),
  pas un projet (« skera-api »).

Règle simple : si une phrase ne pourrait pas être lue par un dev extérieur à Xefi, elle ne va
pas dans `construct/`. La publication elle-même est **hors périmètre agent** (décision humaine).

---

## Le gabarit unique

Toutes les briques suivent la **même forme**. Une brique = un dossier `skills/<nom>/SKILL.md`
(ou `commands/<NOM>.md` pour un déclencheur de séquence — voir plus bas).

```markdown
---
name: <nom-kebab-case>
description: Use quand <situation déclencheuse précise> — <ce que la brique fait>. <une phrase>.
---

# <nom>

<Une phrase : le but, et à quelle étape de WORKFLOW.md ça correspond.>

## Quand
<Le déclencheur explicite. Si une checklist existe, une todo par item.>

## Étapes
<Numérotées, actionnables. Ce que le dev/agent fait, dans l'ordre.>

## Sortie / checkpoint
<Ce qui est produit + le checkpoint starfleet écrit (`spec_done`, `verified`, …).>

## Garde-fous
<Ce qu'on ne fait pas. Frontière agent/humain si concernée. Escalade si bloqué.>

## Origine
<Idée reprise de : natif Claude Code / cwc / mattpocock / addyosmani / interne. Honnête.>
```

### Règles de forme (non négociables)
- **Français**, voix Xefi. Description commence par `Use quand …` (déclenchement fiable).
- **Pas de commentaires dans le code** produit ; les explications vont dans le chat/la doc.
- Une brique = **une responsabilité** (cf. découpe de `WORKFLOW.md` §4).
- Ne **jamais** réimplémenter le natif (`/model`, `/code-review`, `/security-review`, hooks,
  mémoire) — on l'invoque, on ne le duplique pas.
- **commands vs skills** : un `command` (`/SPEC`…) est un *déclencheur d'étape* court qui
  invoque la/les `skill(s)` correspondante(s). La logique vit dans la skill, pas dans le
  command. Objectif : une seule source par mécanisme.

---

## État des briques (à consolider sous ce gabarit)

Aujourd'hui les briques sont éclatées (`starfleet/.claude/commands`, `starfleet/.claude/skills`,
`construct/skills`) et de formats différents. Cible : **tout sous `construct/skills`**, un
`command` mince par étape, gabarit unique. Correspondance étape → brique dans `WORKFLOW.md` §2.

Manques à écrire (à notre sauce) : **brainstorm** (1), **archi/graphify** (3), **GATE
default-FAIL + evaluator** (7), + renforts **grill→ADR** (2), **review 2 axes** (8), **contrat
`{passes:false}`** (5), **finish** (11, wrapper de `finish_task`).
