import type Database from 'better-sqlite3'
import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { AutoCardView } from '../../../../contract/AutopilotContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { StoryPlacement } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import { createForgeBoardView } from './ForgeBoardView.js'
import { prepareForgeBoardStatements, type CardRow } from './ForgeBoardStatements.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import { ForgeCardNotFoundError } from './ForgeCardViolation.js'

export type ForgeBoardRepository = {
  list: (projectId: number) => readonly ForgeCardView[]
  view: (forgeCardId: number) => ForgeCardView
  placementOf: (storyId: number) => StoryPlacement
  backfillCards: () => number
}

export function createForgeBoardRepository(
  db: Database.Database,
  {
    forgeCards,
    columns,
    autoOf,
  }: {
    forgeCards: ForgeCardRepository
    columns: WorkflowColumnRepository
    autoOf?: (view: ForgeCardView) => AutoCardView | null
  },
): ForgeBoardRepository {
  const statements = prepareForgeBoardStatements(db)
  const { selectOfProject, selectOne, selectStoriesWithoutCard, selectPlacement } = statements
  const { viewOf } = createForgeBoardView(statements, autoOf)

  const backfillCards = db.transaction((): number => {
    const missing = selectStoriesWithoutCard.all()
    for (const story of missing) {
      forgeCards.attachCardToStory(story.id)
    }
    return missing.length
  })

  return {
    backfillCards,

    list: (projectId) => {
      const cache = new Map<number | null, readonly WorkflowColumn[]>()
      const stepsOf = (row: CardRow): readonly WorkflowColumn[] => {
        const known = cache.get(row.workflow_id)
        if (known !== undefined) {
          return known
        }
        const loaded = row.workflow_id === null ? [] : columns.list(row.project_id, row.workflow_id)
        cache.set(row.workflow_id, loaded)
        return loaded
      }
      return selectOfProject.all(projectId).map((row) => viewOf(row, stepsOf(row)))
    },

    view: (forgeCardId) => {
      const row = selectOne.get(forgeCardId)
      if (row === undefined) {
        throw new ForgeCardNotFoundError(forgeCardId)
      }
      return viewOf(row, row.workflow_id === null ? [] : columns.list(row.project_id, row.workflow_id))
    },

    placementOf: (storyId) => {
      const row = selectPlacement.get(storyId)
      if (row === undefined) {
        throw new RangeError(`story ${storyId} not found`)
      }
      return { state: row.state, workflowColumnId: row.workflow_column_id }
    },
  }
}
