import type Database from 'better-sqlite3'
import type { AgentPhase } from '../../../../contract/AgentContract.js'
import type { ForgeCardProvider } from '../../../../contract/ForgeCardContract.js'

export type ForgeCardRow = {
  id: number
  reference: string
  provider: ForgeCardProvider
  claude_session_id: string | null
  current_phase: AgentPhase | null
  created_at: string
  closed_at: string | null
}

type StoryLookupRow = {
  id: number
  reference: string
  state: string
}

export type ForgeCardStatements = ReturnType<typeof prepareForgeCardStatements>

export function prepareForgeCardStatements(db: Database.Database) {
  return {
    countCards: db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM forge_card'),
    insertCard: db.prepare<[string, ForgeCardProvider]>('INSERT INTO forge_card (reference, provider) VALUES (?, ?)'),
    linkStory: db.prepare<[number, number]>('INSERT INTO forge_card_story (forge_card_id, story_id) VALUES (?, ?)'),
    closeCard: db.prepare<[number]>('UPDATE forge_card SET closed_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updateDispatchProgress: db.prepare<[string, AgentPhase, number]>(
      'UPDATE forge_card SET claude_session_id = ?, current_phase = ? WHERE id = ?',
    ),
    selectStory: db.prepare<[number], StoryLookupRow>('SELECT id, reference, state FROM story WHERE id = ?'),
    selectProjectOfStory: db.prepare<[number], { project_id: number }>(
      'SELECT epic.project_id AS project_id FROM story JOIN epic ON epic.id = story.epic_id WHERE story.id = ?',
    ),
    selectProjectOfWorkflow: db.prepare<[number], { project_id: number }>(
      'SELECT project_id FROM workflow WHERE id = ?',
    ),
    updateStoryWorkflow: db.prepare<[number, number]>('UPDATE story SET workflow_id = ? WHERE id = ?'),
    selectOpenCardIdForStory: db.prepare<[number], { forge_card_id: number }>(`
    SELECT fcs.forge_card_id AS forge_card_id
    FROM forge_card_story fcs
    JOIN forge_card fc ON fc.id = fcs.forge_card_id
    WHERE fcs.story_id = ? AND fc.closed_at IS NULL
  `),
    selectAnyCardIdForStory: db.prepare<[number], { forge_card_id: number }>(`
    SELECT fcs.forge_card_id AS forge_card_id
    FROM forge_card_story fcs
    JOIN forge_card fc ON fc.id = fcs.forge_card_id
    WHERE fcs.story_id = ?
    ORDER BY (fc.closed_at IS NULL) DESC, fc.id DESC
    LIMIT 1
  `),
    selectCard: db.prepare<[number], ForgeCardRow>(
      'SELECT id, reference, provider, claude_session_id, current_phase, created_at, closed_at FROM forge_card WHERE id = ?',
    ),
    selectStoryIdsOfCard: db.prepare<[number], { story_id: number }>(
      'SELECT story_id FROM forge_card_story WHERE forge_card_id = ? ORDER BY story_id',
    ),
  }
}
