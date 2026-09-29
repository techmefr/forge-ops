import type Database from 'better-sqlite3'
import {
  BACKLOG_STEP_KEY,
  DONE_STEP_KEY,
  type ForgeCardProvider,
  type ForgeCardView,
} from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import type { StoryPlacement } from '../Story/StoryRepository.js'
import type { StoryState } from '../Story/Story.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import { ForgeCardNotFoundError } from './ForgeCardViolation.js'
import { phaseOfStep, statusOf, type LatestSession } from './ForgeCardStatus.js'

type CardRow = {
  id: number
  reference: string
  provider: ForgeCardProvider
  claude_session_id: string | null
  story_id: number
  story_reference: string
  title: string
  state: StoryState
  workflow_column_id: number | null
  epic_id: number
  epic_title: string
  project_id: number
}

type SessionRow = {
  phase: AgentPhase
  lifecycle: string
  outcome: string | null
  claude_session_id: string
}

type TotalsRow = {
  cost: number
  seconds: number
}

type PlacementRow = {
  state: StoryState
  workflow_column_id: number | null
}

export type ForgeBoardRepository = {
  list: (projectId: number) => readonly ForgeCardView[]
  view: (forgeCardId: number) => ForgeCardView
  placementOf: (storyId: number) => StoryPlacement
  backfillCards: () => number
}

const CARD_SELECT = `
  SELECT fc.id AS id, fc.reference AS reference, fc.provider AS provider,
         fc.claude_session_id AS claude_session_id,
         story.id AS story_id, story.reference AS story_reference, story.title AS title,
         story.state AS state, story.workflow_column_id AS workflow_column_id,
         epic.id AS epic_id, epic.title AS epic_title, epic.project_id AS project_id
    FROM forge_card fc
    JOIN forge_card_story fcs ON fcs.forge_card_id = fc.id
     AND fcs.story_id = (SELECT MIN(story_id) FROM forge_card_story WHERE forge_card_id = fc.id)
    JOIN story ON story.id = fcs.story_id
    JOIN epic ON epic.id = story.epic_id
`

export function createForgeBoardRepository(
  db: Database.Database,
  { forgeCards, columns }: { forgeCards: ForgeCardRepository; columns: WorkflowColumnRepository },
): ForgeBoardRepository {
  const selectOfProject = db.prepare<[number], CardRow>(`${CARD_SELECT} WHERE epic.project_id = ? ORDER BY fc.id`)
  const selectOne = db.prepare<[number], CardRow>(`${CARD_SELECT} WHERE fc.id = ?`)
  const selectStoriesWithoutCard = db.prepare<[], { id: number }>(
    `SELECT story.id AS id
       FROM story
      WHERE story.kind = 'functional'
        AND story.state <> 'drafting'
        AND NOT EXISTS (SELECT 1 FROM forge_card_story WHERE forge_card_story.story_id = story.id)
      ORDER BY story.id`,
  )
  const selectLatestSession = db.prepare<[number], SessionRow>(
    `SELECT phase, lifecycle, outcome, claude_session_id
       FROM agent_session WHERE story_id = ? ORDER BY id DESC LIMIT 1`,
  )
  const selectTotals = db.prepare<[number], TotalsRow>(
    `SELECT COALESCE(SUM(cost_usd), 0) AS cost,
            COALESCE(SUM(MAX(strftime('%s', COALESCE(ended_at, 'now')) - strftime('%s', started_at), 0)), 0) AS seconds
       FROM agent_session WHERE story_id = ?`,
  )
  const selectPlacement = db.prepare<[number], PlacementRow>(
    'SELECT state, workflow_column_id FROM story WHERE id = ?',
  )

  function stepKeyOf(row: CardRow, steps: readonly WorkflowColumn[]): string {
    if (row.state === 'done') {
      return DONE_STEP_KEY
    }
    const placed = steps.find((step) => step.id === row.workflow_column_id)
    if (placed !== undefined) {
      return placed.key
    }
    return BACKLOG_STEP_KEY
  }

  function viewOf(row: CardRow, steps: readonly WorkflowColumn[]): ForgeCardView {
    const stepKey = stepKeyOf(row, steps)
    const step = steps.find((candidate) => candidate.key === stepKey)
    const latest = selectLatestSession.get(row.story_id)
    const totals = selectTotals.get(row.story_id)
    const currentPhase = phaseOfStep(
      stepKey,
      steps.map((candidate) => candidate.key),
    )
    const session: LatestSession | null =
      latest === undefined ? null : { phase: latest.phase, lifecycle: latest.lifecycle, outcome: latest.outcome }
    return {
      id: row.id,
      reference: row.reference,
      storyId: row.story_id,
      storyReference: row.story_reference,
      title: row.title,
      projectId: row.project_id,
      subjectId: row.epic_id,
      subjectTitle: row.epic_title,
      stepKey,
      provider: row.provider,
      status: statusOf({
        stepKey,
        stepIsHuman: step?.provider === 'human',
        currentPhase,
        latest: session,
      }),
      claudeSessionId: latest?.claude_session_id ?? row.claude_session_id,
      durationSeconds: totals?.seconds ?? 0,
      costUsd: Number((totals?.cost ?? 0).toFixed(4)),
    }
  }

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
      const steps = columns.list(projectId)
      return selectOfProject.all(projectId).map((row) => viewOf(row, steps))
    },

    view: (forgeCardId) => {
      const row = selectOne.get(forgeCardId)
      if (row === undefined) {
        throw new ForgeCardNotFoundError(forgeCardId)
      }
      return viewOf(row, columns.list(row.project_id))
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
