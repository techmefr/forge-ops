import type Database from 'better-sqlite3'
import { STORY_WORKFLOW_ID_SQL } from '../Workflow/ProjectWorkflowRepository.js'
import type { Story, StoryState } from './Story.js'
import { HUMAN_GATE_STATES } from './HumanGate.js'
import type { StoryRow } from './StoryRows.js'

export type StoryStatements = ReturnType<typeof prepareStoryStatements>

export function prepareStoryStatements(db: Database.Database) {
  return {
    insertStory: db.prepare<[number, number | null, string, string, string, Story['kind']]>(
      'INSERT INTO story (epic_id, twin_of_story_id, reference, title, body, kind) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    selectStory: db.prepare<[number], StoryRow>('SELECT * FROM story WHERE id = ?'),
    selectTwin: db.prepare<[number], StoryRow>('SELECT * FROM story WHERE twin_of_story_id = ?'),
    selectProjectOfStory: db.prepare<[number], { project_id: number }>(
      `SELECT epic.project_id AS project_id FROM story
         JOIN epic ON epic.id = story.epic_id
        WHERE story.id = ?`,
    ),
    selectProjectSlug: db.prepare<[number], { slug: string }>(
      'SELECT project.slug AS slug FROM epic JOIN project ON project.id = epic.project_id WHERE epic.id = ?',
    ),
    countFunctionalStories: db.prepare<[number], { total: number }>(
      `SELECT COUNT(*) AS total FROM story
         JOIN epic ON epic.id = story.epic_id
        WHERE epic.project_id = (SELECT project_id FROM epic WHERE id = ?)
          AND story.kind = 'functional'`,
    ),
    updateState: db.prepare<[StoryState, StoryState, number]>(
      `UPDATE story
          SET state = ?,
              workflow_column_id = (
                SELECT workflow_column.id FROM workflow_column
                  WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
              ),
              updated_at = datetime('now')
        WHERE id = ?`,
    ),
    updatePlacement: db.prepare<[StoryState, number | null, number]>(
      "UPDATE story SET state = ?, workflow_column_id = ?, updated_at = datetime('now') WHERE id = ?",
    ),
    selectBacklog: db.prepare<[], StoryRow>(
      "SELECT * FROM story WHERE kind = 'functional' AND state = 'backlog' ORDER BY id",
    ),
    selectKanban: db.prepare<[], StoryRow>(
      `SELECT * FROM story
        WHERE kind = 'functional' AND state <> 'drafting'
        ORDER BY id`,
    ),
    updateCard: db.prepare<[string, string, number]>('UPDATE story SET title = ?, body = ? WHERE id = ?'),
    updatePoints: db.prepare<[number, number]>(
      "UPDATE story SET points = ?, updated_at = datetime('now') WHERE id = ?",
    ),
    updateRollout: db.prepare<[number, number]>(
      "UPDATE story SET rollout_percent = ?, state = 'flagged', updated_at = datetime('now') WHERE id = ?",
    ),
    updateMergeConflict: db.prepare<[number, number]>(
      "UPDATE story SET merge_conflict = ?, updated_at = datetime('now') WHERE id = ?",
    ),
    updateBlockedReason: db.prepare<[string | null, number]>(
      "UPDATE story SET blocked_reason = ?, updated_at = datetime('now') WHERE id = ?",
    ),
    selectHumanGateWaits: db.prepare<
      string[],
      { id: number; reference: string; state: StoryState; updated_at: string; waiting_seconds: number }
    >(
      `SELECT id, reference, state, updated_at,
              CAST((julianday('now') - julianday(updated_at)) * 86400 AS INTEGER) AS waiting_seconds
         FROM story
        WHERE kind = 'functional'
          AND state IN (${HUMAN_GATE_STATES.map(() => '?').join(', ')})
        ORDER BY waiting_seconds DESC`,
    ),
  }
}
