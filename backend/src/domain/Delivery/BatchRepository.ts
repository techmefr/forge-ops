import type Database from 'better-sqlite3'
import { branchNameFor } from '../Worktree/Branch.js'
import { prepareBatchStatements, type BatchRow, type StoryRow } from './BatchStatements.js'
import {
  DEFAULT_GROUPING,
  extractionOf,
  groupingOf,
  isRefusal,
  joinRefusalOf,
  type Batch,
  type Extraction,
  type GroupingMode,
} from './Grouping.js'

export const GROUPING_KEY = 'delivery.grouping'

export class BatchRefusedError extends Error {
  constructor(public readonly refusal: string) {
    super(`la demande de fusion refuse ce changement: ${refusal}`)
    this.name = 'BatchRefusedError'
  }
}

export class BatchNotFoundError extends Error {
  constructor(batchId: number) {
    super(`aucune demande de fusion ${batchId}`)
    this.name = 'BatchNotFoundError'
  }
}

export type BatchRepository = {
  grouping: () => GroupingMode
  settleGrouping: (mode: GroupingMode) => GroupingMode
  openBatch: (storyId: number) => Batch
  findBatch: (batchId: number) => Batch
  batchOfStory: (storyId: number) => Batch | null
  join: (batchId: number, storyId: number) => Batch
  extract: (batchId: number, storyId: number) => { batch: Batch; extracted: Batch }
  ship: (batchId: number) => Batch
}

export function createBatchRepository(db: Database.Database): BatchRepository {
  const {
    selectSetting,
    writeSetting,
    selectStory,
    selectProjectOfStory,
    insertBatch,
    selectBatch,
    selectBatchOfStory,
    selectStories,
    insertStory,
    deleteStory,
    shipBatch,
  } = prepareBatchStatements(db)

  function storyOf(storyId: number): StoryRow {
    const row = selectStory.get(storyId)
    if (row === undefined) {
      throw new BatchRefusedError('StoryNotFound')
    }
    return row
  }

  function toBatch(row: BatchRow): Batch {
    return {
      id: row.id,
      projectId: row.project_id,
      branch: row.branch,
      state: row.state,
      storyIds: selectStories.all(row.id).map((one) => one.story_id),
    }
  }

  function findBatch(batchId: number): Batch {
    const row = selectBatch.get(batchId)
    if (row === undefined) {
      throw new BatchNotFoundError(batchId)
    }
    return toBatch(row)
  }

  function open(storyId: number): Batch {
    const story = storyOf(storyId)
    const projectId = selectProjectOfStory.get(storyId)?.project_id ?? 0
    const written = insertBatch.run(projectId, branchNameFor(story.reference, story.title))
    const batchId = Number(written.lastInsertRowid)
    insertStory.run(batchId, storyId)
    return findBatch(batchId)
  }

  return {
    grouping: () => groupingOf(selectSetting.get(GROUPING_KEY)?.value ?? null),

    settleGrouping: (mode) => {
      writeSetting.run(GROUPING_KEY, mode)
      return mode
    },

    openBatch: open,
    findBatch,

    batchOfStory: (storyId) => {
      const row = selectBatchOfStory.get(storyId)
      return row === undefined ? null : toBatch(row)
    },

    join: (batchId, storyId) => {
      const batch = findBatch(batchId)
      const story = storyOf(storyId)
      const projectId = selectProjectOfStory.get(story.id)?.project_id ?? 0
      const refusal = joinRefusalOf(
        groupingOf(selectSetting.get(GROUPING_KEY)?.value ?? DEFAULT_GROUPING),
        batch,
        { id: story.id, projectId },
      )
      if (refusal !== null) {
        throw new BatchRefusedError(refusal)
      }
      insertStory.run(batchId, storyId)
      return findBatch(batchId)
    },

    extract: (batchId, storyId) => {
      const batch = findBatch(batchId)
      const outcome = extractionOf(batch, storyId)
      if (isRefusal(outcome)) {
        throw new BatchRefusedError(outcome)
      }
      const extraction: Extraction = outcome
      deleteStory.run(batchId, extraction.storyId)
      return { batch: findBatch(batchId), extracted: open(extraction.storyId) }
    },

    ship: (batchId) => {
      findBatch(batchId)
      shipBatch.run(batchId)
      return findBatch(batchId)
    },
  }
}
