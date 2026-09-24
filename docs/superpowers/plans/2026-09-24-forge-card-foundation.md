# Forge Card Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the `ForgeCard` entity (schema, domain rules, repository) as an additive, non-breaking foundation - a card born from one or more backlog stories - without yet moving `worktree`, `agent_session`, or the kanban-movement columns of `story` onto it. That rewiring is a separate follow-on plan once this lands and is reviewed against `docs/StoryForgeCard.md`.

**Architecture:** New `forge_card` table (one row per work session) and `forge_card_story` join table (which stories a card bundles). A `ForgeCardRepository.createForgeCard(storyIds)` is the single entry point: it validates the selection, inserts the card row, links every story, and returns the card. Follows the existing `Story`/`StoryRepository` split exactly - `ForgeCard.ts` holds pure validation, `ForgeCardRepository.ts` holds the SQL, `ForgeCardViolation.ts` holds the typed refusals.

**Tech Stack:** TypeScript, better-sqlite3, Vitest. No new dependencies.

---

## File Structure

- Create: `db/forge.sql` (modify - add two tables)
- Create: `contract/ForgeCardContract.ts` - shared types (`ForgeCard`, `ForgeCardDraft`)
- Create: `backend/src/domain/ForgeCard/ForgeCard.ts` - pure validation (`refusalOfSelection`)
- Create: `backend/src/domain/ForgeCard/ForgeCardViolation.ts` - typed errors
- Create: `backend/src/domain/ForgeCard/ForgeCardRepository.ts` - SQL-backed repository
- Create: `backend/tests/domain/ForgeCard/ForgeCard.test.ts`
- Create: `backend/tests/domain/ForgeCard/ForgeCardRepository.test.ts`

---

### Task 1: Schema - `forge_card` and `forge_card_story` tables

**Files:**
- Modify: `db/forge.sql` (append after the `worktree` table block, i.e. after line 126)

- [ ] **Step 1: Add the two tables to `db/forge.sql`**

Insert this block immediately after the `worktree` table's closing `);` (currently line 126) and before the `port_reservation` table:

```sql
CREATE TABLE IF NOT EXISTS forge_card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS forge_card_story (
  forge_card_id INTEGER NOT NULL REFERENCES forge_card(id),
  story_id INTEGER NOT NULL REFERENCES story(id),
  PRIMARY KEY (forge_card_id, story_id)
);
```

No standalone `UNIQUE` on `story_id`: a story that came back to the backlog because its card closed without merging must be selectable into a new card. "A story can only belong to one **open** Forge Card at a time" is an application-level rule (Task 5's `openCardOfStory` check), not a database constraint - the database only stops the same story linking twice to the same card.

- [ ] **Step 2: Verify the schema loads**

Run: `cd backend && npx vitest run tests/technical/Database/Migration.test.ts`
Expected: PASS (this exercises `openDatabase`, which execs the full `forge.sql` - confirms no SQL syntax error)

- [ ] **Step 3: Place the new tables on the instance side**

`backend/tests/domain/Boundary/Boundary.test.ts` requires every table declared in `db/forge.sql` to be listed in either `SERVER_HELD` or `INSTANCE_HELD` (`contract/BoundaryContract.ts`). A forge card is the running work session - worktree, conversation - so it's instance-held, next to `worktree` and `agent_session`. Add both new tables there:

```typescript
  'worktree',
  'forge_card',
  'forge_card_story',
  'port_reservation',
```

Run: `npx vitest run backend/tests/domain/Boundary/`
Expected: PASS (12 tests)

- [ ] **Step 4: Commit**

```bash
git add db/forge.sql contract/BoundaryContract.ts
git commit -m "feat(schema): add forge_card and forge_card_story tables"
```

---

### Task 2: Contract types

**Files:**
- Create: `contract/ForgeCardContract.ts`

- [ ] **Step 1: Write the contract**

```typescript
export type ForgeCard = {
  id: number
  reference: string
  storyIds: readonly number[]
  createdAt: string
  closedAt: string | null
}

export type ForgeCardDraft = {
  storyIds: readonly number[]
}
```

- [ ] **Step 2: Commit**

```bash
git add contract/ForgeCardContract.ts
git commit -m "feat(contract): add ForgeCard and ForgeCardDraft types"
```

---

### Task 3: Domain validation - `refusalOfSelection`

**Files:**
- Create: `backend/src/domain/ForgeCard/ForgeCard.ts`
- Test: `backend/tests/domain/ForgeCard/ForgeCard.test.ts`

This mirrors `WorkflowColumn.ts`'s `refusalOfDraft` shape (`backend/src/domain/Workflow/WorkflowColumn.ts`): a pure function returning a typed refusal or `null`, no I/O. The repository (Task 4) calls it before touching the database for the checks it can do without a query (empty selection, duplicate ids in the same request); the repository does its own checks for the ones that need the database (story exists, story is `backlog`, story not already on an open card).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest'
import { refusalOfSelection } from '../../../src/domain/ForgeCard/ForgeCard.js'

describe('refusalOfSelection', () => {
  it('refuse une selection vide', () => {
    expect(refusalOfSelection([])).toEqual({ reason: 'EmptySelection' })
  })

  it('refuse une selection avec un doublon', () => {
    expect(refusalOfSelection([4, 7, 4])).toEqual({ reason: 'DuplicateStoryId', storyId: 4 })
  })

  it('accepte une selection valide', () => {
    expect(refusalOfSelection([4, 7])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/domain/ForgeCard/ForgeCard.test.ts`
Expected: FAIL with "Cannot find module '../../../src/domain/ForgeCard/ForgeCard.js'"

- [ ] **Step 3: Write the implementation**

```typescript
export type ForgeCardSelectionRefusal =
  | { reason: 'EmptySelection' }
  | { reason: 'DuplicateStoryId'; storyId: number }

export function refusalOfSelection(storyIds: readonly number[]): ForgeCardSelectionRefusal | null {
  if (storyIds.length === 0) {
    return { reason: 'EmptySelection' }
  }
  const seen = new Set<number>()
  for (const storyId of storyIds) {
    if (seen.has(storyId)) {
      return { reason: 'DuplicateStoryId', storyId }
    }
    seen.add(storyId)
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/domain/ForgeCard/ForgeCard.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/ForgeCard/ForgeCard.ts backend/tests/domain/ForgeCard/ForgeCard.test.ts
git commit -m "feat(forge-card): validate a story selection before it becomes a card"
```

---

### Task 4: Typed violations

**Files:**
- Create: `backend/src/domain/ForgeCard/ForgeCardViolation.ts`

No test file for this task - it's mirrored one-to-one from `backend/src/domain/Story/StoryViolation.ts`'s pattern, and Task 5's repository tests exercise every branch by triggering the throw.

- [ ] **Step 1: Write the violations**

```typescript
export abstract class ForgeCardViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class EmptySelectionError extends ForgeCardViolationError {
  constructor() {
    super('Une forge a besoin d au moins une story', 'EmptySelectionError')
  }
}

export class DuplicateStoryIdError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`La story ${storyId} est selectionnee deux fois`, 'DuplicateStoryIdError')
  }
}

export class ForgeStoryNotFoundError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`Story ${storyId} introuvable`, 'ForgeStoryNotFoundError')
  }
}

export class StoryNotInBacklogError extends ForgeCardViolationError {
  constructor(reference: string, state: string) {
    super(`La story ${reference} est en ${state}, pas dans le backlog`, 'StoryNotInBacklogError')
  }
}

export class StoryAlreadyOnOpenCardError extends ForgeCardViolationError {
  constructor(reference: string, forgeCardReference: string) {
    super(`La story ${reference} est deja portee par la forge ${forgeCardReference}`, 'StoryAlreadyOnOpenCardError')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/domain/ForgeCard/ForgeCardViolation.ts
git commit -m "feat(forge-card): add typed violations for card creation"
```

---

### Task 5: Repository - `createForgeCard` and lookups

**Files:**
- Create: `backend/src/domain/ForgeCard/ForgeCardRepository.ts`
- Test: `backend/tests/domain/ForgeCard/ForgeCardRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository, type ForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  DuplicateStoryIdError,
  EmptySelectionError,
  ForgeStoryNotFoundError,
  StoryAlreadyOnOpenCardError,
  StoryNotInBacklogError,
} from '../../../src/domain/ForgeCard/ForgeCardViolation.js'

let db: Database.Database
let stories: StoryRepository
let cards: ForgeCardRepository
let epicId: number
let firstStoryId: number
let secondStoryId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  cards = createForgeCardRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'demo', businessIntent: 'besoin' })
  epicId = epic.id
  const first = stories.writeStory({ epicId, title: 'premiere', body: 'corps' })
  const second = stories.writeStory({ epicId, title: 'seconde', body: 'corps' })
  stories.writeTwin({ storyId: first.id, title: 'jumelle 1', body: 'corps' })
  stories.sendToBacklog(first.id)
  stories.writeTwin({ storyId: second.id, title: 'jumelle 2', body: 'corps' })
  stories.sendToBacklog(second.id)
  firstStoryId = first.id
  secondStoryId = second.id
})

describe('createForgeCard', () => {
  it('cree une forge portant une story et l assigne', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(card.storyIds).toEqual([firstStoryId])
    expect(card.reference).toBe('FORGE-1')
    expect(card.closedAt).toBeNull()
  })

  it('cree une forge portant plusieurs stories', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId, secondStoryId] })
    expect(card.storyIds).toEqual([firstStoryId, secondStoryId])
  })

  it('refuse une selection vide', () => {
    expect(() => cards.createForgeCard({ storyIds: [] })).toThrow(EmptySelectionError)
  })

  it('refuse un doublon dans la selection', () => {
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId, firstStoryId] })).toThrow(DuplicateStoryIdError)
  })

  it('refuse une story introuvable', () => {
    expect(() => cards.createForgeCard({ storyIds: [999] })).toThrow(ForgeStoryNotFoundError)
  })

  it('refuse une story qui n est pas dans le backlog', () => {
    const drafting = stories.writeStory({ epicId, title: 'brouillon', body: 'corps' })
    expect(() => cards.createForgeCard({ storyIds: [drafting.id] })).toThrow(StoryNotInBacklogError)
  })

  it('refuse une story deja portee par une forge ouverte', () => {
    cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId] })).toThrow(StoryAlreadyOnOpenCardError)
  })

  it('accepte une story dont la forge precedente est fermee', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    cards.closeForgeCard(card.id)
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId] })).not.toThrow()
  })
})

describe('openCardOfStory', () => {
  it('rend la forge ouverte qui porte la story', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(cards.openCardOfStory(firstStoryId)?.id).toBe(card.id)
  })

  it('rend null quand la story n est portee par aucune forge', () => {
    expect(cards.openCardOfStory(firstStoryId)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/domain/ForgeCard/ForgeCardRepository.test.ts`
Expected: FAIL with "Cannot find module '../../../src/domain/ForgeCard/ForgeCardRepository.js'"

- [ ] **Step 3: Write the implementation**

```typescript
import type Database from 'better-sqlite3'
import type { ForgeCard, ForgeCardDraft } from '../../../../contract/ForgeCardContract.js'
import { refusalOfSelection } from './ForgeCard.js'
import {
  DuplicateStoryIdError,
  EmptySelectionError,
  ForgeStoryNotFoundError,
  StoryAlreadyOnOpenCardError,
  StoryNotInBacklogError,
} from './ForgeCardViolation.js'

type ForgeCardRow = {
  id: number
  reference: string
  created_at: string
  closed_at: string | null
}

type StoryLookupRow = {
  id: number
  reference: string
  state: string
}

export type ForgeCardRepository = {
  createForgeCard: (draft: ForgeCardDraft) => ForgeCard
  closeForgeCard: (forgeCardId: number) => void
  openCardOfStory: (storyId: number) => ForgeCard | null
}

export function createForgeCardRepository(db: Database.Database): ForgeCardRepository {
  const countCards = db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM forge_card')
  const insertCard = db.prepare<[string]>('INSERT INTO forge_card (reference) VALUES (?)')
  const linkStory = db.prepare<[number, number]>(
    'INSERT INTO forge_card_story (forge_card_id, story_id) VALUES (?, ?)',
  )
  const closeCard = db.prepare<[number]>("UPDATE forge_card SET closed_at = CURRENT_TIMESTAMP WHERE id = ?")
  const selectStory = db.prepare<[number], StoryLookupRow>('SELECT id, reference, state FROM story WHERE id = ?')
  const selectOpenCardIdForStory = db.prepare<[number], { forge_card_id: number }>(`
    SELECT fcs.forge_card_id AS forge_card_id
    FROM forge_card_story fcs
    JOIN forge_card fc ON fc.id = fcs.forge_card_id
    WHERE fcs.story_id = ? AND fc.closed_at IS NULL
  `)
  const selectCard = db.prepare<[number], ForgeCardRow>('SELECT id, reference, created_at, closed_at FROM forge_card WHERE id = ?')
  const selectStoryIdsOfCard = db.prepare<[number], { story_id: number }>(
    'SELECT story_id FROM forge_card_story WHERE forge_card_id = ? ORDER BY story_id',
  )

  function hydrate(row: ForgeCardRow): ForgeCard {
    return {
      id: row.id,
      reference: row.reference,
      storyIds: selectStoryIdsOfCard.all(row.id).map((link) => link.story_id),
      createdAt: row.created_at,
      closedAt: row.closed_at,
    }
  }

  function findCard(forgeCardId: number): ForgeCard {
    const row = selectCard.get(forgeCardId)
    if (row === undefined) {
      throw new RangeError(`forge card ${forgeCardId} introuvable`)
    }
    return hydrate(row)
  }

  return {
    createForgeCard: (draft) => {
      const refusal = refusalOfSelection(draft.storyIds)
      if (refusal !== null) {
        if (refusal.reason === 'EmptySelection') {
          throw new EmptySelectionError()
        }
        throw new DuplicateStoryIdError(refusal.storyId)
      }
      for (const storyId of draft.storyIds) {
        const story = selectStory.get(storyId)
        if (story === undefined) {
          throw new ForgeStoryNotFoundError(storyId)
        }
        if (story.state !== 'backlog') {
          throw new StoryNotInBacklogError(story.reference, story.state)
        }
        const openLink = selectOpenCardIdForStory.get(storyId)
        if (openLink !== undefined) {
          const openCard = findCard(openLink.forge_card_id)
          throw new StoryAlreadyOnOpenCardError(story.reference, openCard.reference)
        }
      }
      const reference = `FORGE-${(countCards.get()?.total ?? 0) + 1}`
      const info = insertCard.run(reference)
      const forgeCardId = Number(info.lastInsertRowid)
      for (const storyId of draft.storyIds) {
        linkStory.run(forgeCardId, storyId)
      }
      return findCard(forgeCardId)
    },

    closeForgeCard: (forgeCardId) => {
      closeCard.run(forgeCardId)
    },

    openCardOfStory: (storyId) => {
      const link = selectOpenCardIdForStory.get(storyId)
      return link === undefined ? null : findCard(link.forge_card_id)
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/domain/ForgeCard/ForgeCardRepository.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full backend suite to confirm no regression**

Run: `cd backend && npx vitest run`
Expected: PASS (all existing tests still green - this task only adds files, touches no existing ones)

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/ForgeCard/ForgeCardRepository.ts backend/tests/domain/ForgeCard/ForgeCardRepository.test.ts
git commit -m "feat(forge-card): add ForgeCardRepository with createForgeCard and openCardOfStory"
```

---

## What this plan deliberately leaves out

- `WorktreeApi`/`Worktree` still keys on `story_id`, not `forge_card_id` - moving it is the next plan, once this one is reviewed.
- No HTTP endpoint or frontend wiring yet - `ForgeCardRepository` is callable but not reachable from the board. The "Lancer une forge" button and the backlog multi-select come with that next plan, once `Dispatch`/`SdkSessionRunner` know what a `ForgeCardId` is for.
- `story.state`'s workflow values (`architecture`, `building`, ...) are untouched - stories still show that state today. Retiring it in favor of the card's own column position is the last step of the migration, done only once nothing reads `story.state` for workflow purposes anymore.
