import type Database from 'better-sqlite3'
import type { ForgeCardProvider } from '../../../../contract/ForgeCardContract.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import type { StoryState } from '../Story/Story.js'
import { STORY_WORKFLOW_ID_SQL } from '../Workflow/ProjectWorkflowRepository.js'

export type CardRow = {
  id: number
  reference: string
  provider: ForgeCardProvider
  claude_session_id: string | null
  story_id: number
  story_reference: string
  title: string
  state: StoryState
  workflow_column_id: number | null
  workflow_id: number | null
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
  inputTokens: number
  outputTokens: number
}

type PlacementRow = {
  state: StoryState
  workflow_column_id: number | null
}

export type ForgeBoardStatements = ReturnType<typeof prepareForgeBoardStatements>

const CARD_SELECT = `
  SELECT fc.id AS id, fc.reference AS reference, fc.provider AS provider,
         fc.claude_session_id AS claude_session_id,
         story.id AS story_id, story.reference AS story_reference, story.title AS title,
         story.state AS state, story.workflow_column_id AS workflow_column_id,
         ${STORY_WORKFLOW_ID_SQL} AS workflow_id,
         epic.id AS epic_id, epic.title AS epic_title, epic.project_id AS project_id
    FROM forge_card fc
    JOIN forge_card_story fcs ON fcs.forge_card_id = fc.id
     AND fcs.story_id = (SELECT MIN(story_id) FROM forge_card_story WHERE forge_card_id = fc.id)
    JOIN story ON story.id = fcs.story_id
    JOIN epic ON epic.id = story.epic_id
`

export function prepareForgeBoardStatements(db: Database.Database) {
  return {
    selectOfProject: db.prepare<[number], CardRow>(
      `${CARD_SELECT} WHERE epic.project_id = ? AND epic.deleted_at IS NULL ORDER BY fc.id`,
    ),
    selectOne: db.prepare<[number], CardRow>(`${CARD_SELECT} WHERE fc.id = ?`),
    selectStoriesWithoutCard: db.prepare<[], { id: number }>(
      `SELECT story.id AS id
       FROM story
      WHERE story.kind = 'functional'
        AND story.state <> 'drafting'
        AND NOT EXISTS (SELECT 1 FROM forge_card_story WHERE forge_card_story.story_id = story.id)
      ORDER BY story.id`,
    ),
    selectLatestSession: db.prepare<[number], SessionRow>(
      `SELECT phase, lifecycle, outcome, claude_session_id
       FROM agent_session WHERE story_id = ? ORDER BY id DESC LIMIT 1`,
    ),
    selectTotals: db.prepare<[number], TotalsRow>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS cost,
            COALESCE(SUM(input_tokens), 0) AS inputTokens,
            COALESCE(SUM(output_tokens), 0) AS outputTokens,
            COALESCE(SUM(MAX(strftime('%s', COALESCE(idle_since, ended_at, 'now')) - strftime('%s', started_at) - wait_seconds, 0)), 0) AS seconds
       FROM agent_session WHERE story_id = ?`,
    ),
    selectPlacement: db.prepare<[number], PlacementRow>('SELECT state, workflow_column_id FROM story WHERE id = ?'),
  }
}
