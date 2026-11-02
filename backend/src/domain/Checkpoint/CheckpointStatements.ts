import type Database from 'better-sqlite3'
import type { CheckpointName } from './Checkpoint.js'

export type CheckpointRow = {
  id: number
  story_id: number
  name: CheckpointName
  evidence_path: string
}

export type ProofRow = {
  name: CheckpointName
  proven_at: string
  evidence_path: string
}

export type CheckpointStatements = ReturnType<typeof prepareCheckpointStatements>

export function prepareCheckpointStatements(db: Database.Database) {
  return {
    upsertCensus: db.prepare<[number, number, number, number]>(
      `INSERT INTO test_census (story_id, tests, skipped, tautologies) VALUES (?, ?, ?, ?)
       ON CONFLICT (story_id) DO UPDATE SET
         tests = excluded.tests,
         skipped = excluded.skipped,
         tautologies = excluded.tautologies,
         taken_at = datetime('now')`,
    ),
    selectCensus: db.prepare<[number], { tests: number; skipped: number; tautologies: number }>(
      'SELECT tests, skipped, tautologies FROM test_census WHERE story_id = ?',
    ),
    selectStory: db.prepare<[number], { id: number; reference: string; kind: string }>(
      'SELECT id, reference, kind FROM story WHERE id = ?',
    ),
    selectTwin: db.prepare<[number], { id: number }>('SELECT id FROM story WHERE twin_of_story_id = ?'),
    selectCriteriaCount: db.prepare<[number], { total: number }>(
      'SELECT COUNT(*) AS total FROM acceptance_criterion WHERE story_id = ?',
    ),
    selectUnmetCriteria: db.prepare<[number], { reference: string }>(
      `SELECT reference FROM acceptance_criterion
        WHERE story_id = ? AND satisfied_at IS NULL
        ORDER BY reference`,
    ),
    insertCheckpoint: db.prepare<[number, CheckpointName, string]>(
      'INSERT INTO checkpoint (story_id, name, evidence_path) VALUES (?, ?, ?)',
    ),
    selectTouchedPaths: db.prepare<[number], { path: string }>(
      'SELECT DISTINCT path FROM file_touch WHERE story_id = ? ORDER BY path',
    ),
    selectCheckpoints: db.prepare<[number], CheckpointRow>('SELECT * FROM checkpoint WHERE story_id = ?'),
    selectProofs: db.prepare<[number], ProofRow>(
      'SELECT name, proven_at, evidence_path FROM checkpoint WHERE story_id = ? ORDER BY proven_at, id',
    ),
    deleteCheckpoint: db.prepare<[number, CheckpointName]>('DELETE FROM checkpoint WHERE story_id = ? AND name = ?'),
    deletePasses: db.prepare<[number]>('DELETE FROM review_pass WHERE story_id = ?'),
  }
}
