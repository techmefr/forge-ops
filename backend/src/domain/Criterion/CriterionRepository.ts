import type Database from 'better-sqlite3'
import type { Criterion, CriterionDraft } from './Criterion.js'
import {
  CriterionAlreadySatisfiedError,
  CriterionEvidenceRequiredError,
  CriterionNotFoundError,
  CriterionOnTwinError,
} from './CriterionViolation.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import { assertEvidencePath } from '../Evidence/EvidencePath.js'

type CriterionRow = {
  id: number
  story_id: number
  reference: string
  statement: string
  persona: string | null
  expects_refusal: number
  satisfied_at: string | null
  evidence_path: string | null
}

export type CriterionRepository = {
  declareCriterion: (draft: CriterionDraft) => Criterion
  findCriterion: (criterionId: number) => Criterion
  listCriteria: (storyId: number) => readonly Criterion[]
  satisfyCriterion: (criterionId: number, evidencePath: string) => Criterion
  listUnmetCriteria: (storyId: number) => readonly Criterion[]
}

function toCriterion(row: CriterionRow): Criterion {
  return {
    id: row.id,
    storyId: row.story_id,
    reference: row.reference,
    statement: row.statement,
    persona: row.persona,
    expectsRefusal: row.expects_refusal === 1,
    evidencePath: row.evidence_path,
    satisfied: row.satisfied_at !== null,
  }
}

export function createCriterionRepository(database: Database.Database): CriterionRepository {
  const insertCriterion = database.prepare<[number, string, string, string | null, number]>(
    'INSERT INTO acceptance_criterion (story_id, reference, statement, persona, expects_refusal) VALUES (?, ?, ?, ?, ?)',
  )
  const selectCriterion = database.prepare<[number], CriterionRow>(
    'SELECT * FROM acceptance_criterion WHERE id = ?',
  )
  const selectCriteria = database.prepare<[number], CriterionRow>(
    'SELECT * FROM acceptance_criterion WHERE story_id = ? ORDER BY reference',
  )
  const selectUnmet = database.prepare<[number], CriterionRow>(
    'SELECT * FROM acceptance_criterion WHERE story_id = ? AND satisfied_at IS NULL ORDER BY reference',
  )
  const updateSatisfied = database.prepare<[string, number]>(
    "UPDATE acceptance_criterion SET satisfied_at = datetime('now'), evidence_path = ? WHERE id = ?",
  )
  const selectStoryKind = database.prepare<[number], { kind: string; reference: string }>(
    'SELECT kind, reference FROM story WHERE id = ?',
  )

  function findCriterion(criterionId: number): Criterion {
    const row = selectCriterion.get(criterionId)
    if (row === undefined) {
      throw new CriterionNotFoundError(criterionId)
    }
    return toCriterion(row)
  }

  return {
    declareCriterion: (draft) => {
      const story = selectStoryKind.get(draft.storyId)
      if (story === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      if (story.kind === 'test') {
        throw new CriterionOnTwinError(story.reference)
      }
      const info = insertCriterion.run(
        draft.storyId,
        draft.reference,
        draft.statement,
        draft.persona ?? null,
        draft.expectsRefusal === true ? 1 : 0,
      )
      return findCriterion(Number(info.lastInsertRowid))
    },

    findCriterion,

    listCriteria: (storyId) => selectCriteria.all(storyId).map(toCriterion),

    satisfyCriterion: (criterionId, evidencePath) => {
      const criterion = findCriterion(criterionId)
      if (evidencePath.trim() === '') {
        throw new CriterionEvidenceRequiredError(criterion.reference)
      }
      if (criterion.satisfied) {
        throw new CriterionAlreadySatisfiedError(criterion.reference)
      }
      updateSatisfied.run(assertEvidencePath(evidencePath), criterionId)
      return findCriterion(criterionId)
    },

    listUnmetCriteria: (storyId) => selectUnmet.all(storyId).map(toCriterion),
  }
}
