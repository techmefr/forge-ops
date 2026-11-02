import type Database from 'better-sqlite3'
import type { StepBackDraft, StepBackRecord } from './StepBack.js'
import type { StoryState } from './Story.js'
import { toStepBack, type StepBackRow } from './StoryRows.js'
import { StoryNotFoundError } from './StoryViolation.js'

export type StepBackRepository = {
  record: (draft: StepBackDraft, fromState: StoryState) => StepBackRecord
  list: (storyId: number) => readonly StepBackRecord[]
}

export function createStepBackRepository(db: Database.Database): StepBackRepository {
  const insertStepBack = db.prepare<[number, StoryState, StoryState, string, string, string]>(
    `INSERT INTO story_step_back (story_id, from_state, to_state, reason, asked_by, revoked_checkpoints)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const selectStepBack = db.prepare<[number], StepBackRow>('SELECT * FROM story_step_back WHERE id = ?')
  const selectStepBacks = db.prepare<[number], StepBackRow>(
    'SELECT * FROM story_step_back WHERE story_id = ? ORDER BY id',
  )

  return {
    record: (draft, fromState) => {
      const info = insertStepBack.run(
        draft.storyId,
        fromState,
        draft.toState,
        draft.reason,
        draft.askedBy,
        draft.revokedCheckpoints.join(','),
      )
      const row = selectStepBack.get(Number(info.lastInsertRowid))
      if (row === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      return toStepBack(row)
    },

    list: (storyId) => selectStepBacks.all(storyId).map(toStepBack),
  }
}
