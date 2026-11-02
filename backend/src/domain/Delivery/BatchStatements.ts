import type Database from 'better-sqlite3'

export type BatchRow = { id: number; project_id: number; branch: string; state: 'open' | 'shipped' }

export type StoryRow = { id: number; reference: string; title: string; epic_id: number }

export function prepareBatchStatements(db: Database.Database) {
  return {
    selectSetting: db.prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?'),
    writeSetting: db.prepare<[string, string]>(
      `INSERT INTO board_setting (key, value) VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ),
    selectStory: db.prepare<[number], StoryRow>('SELECT id, reference, title, epic_id FROM story WHERE id = ?'),
    selectProjectOfStory: db.prepare<[number], { project_id: number }>(
      `SELECT epic.project_id AS project_id FROM story
       JOIN epic ON epic.id = story.epic_id WHERE story.id = ?`,
    ),
    insertBatch: db.prepare<[number, string]>('INSERT INTO merge_batch (project_id, branch) VALUES (?, ?)'),
    selectBatch: db.prepare<[number], BatchRow>('SELECT id, project_id, branch, state FROM merge_batch WHERE id = ?'),
    selectBatchOfStory: db.prepare<[number], BatchRow>(
      `SELECT merge_batch.id, merge_batch.project_id, merge_batch.branch, merge_batch.state
       FROM merge_batch JOIN batch_story ON batch_story.batch_id = merge_batch.id
      WHERE batch_story.story_id = ? ORDER BY merge_batch.id DESC LIMIT 1`,
    ),
    selectStories: db.prepare<[number], { story_id: number }>(
      'SELECT story_id FROM batch_story WHERE batch_id = ? ORDER BY story_id',
    ),
    insertStory: db.prepare<[number, number]>('INSERT INTO batch_story (batch_id, story_id) VALUES (?, ?)'),
    deleteStory: db.prepare<[number, number]>('DELETE FROM batch_story WHERE batch_id = ? AND story_id = ?'),
    shipBatch: db.prepare<[number]>("UPDATE merge_batch SET state = 'shipped' WHERE id = ?"),
  }
}
