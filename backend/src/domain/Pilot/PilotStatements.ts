import type Database from 'better-sqlite3'
import type { PilotAct } from './Pilot.js'

export type RunRow = {
  id: number
  story_id: number
  reference: string
  url: string
  pace: string
  state: string
  script: string
  position: number
  started_at: string
  ended_at: string | null
}

export type ActRow = {
  id: number
  pilot_run_id: number
  position: number
  kind: string
  target: string | null
  value: string | null
  outcome: string
  detail: string
  screenshot_path: string | null
  acted_at: string
}

export type PilotStatements = ReturnType<typeof preparePilotStatements>

const RUN_SELECTION = `
  SELECT run.id, run.story_id, story.reference, run.url, run.pace, run.state, run.script,
         run.position, run.started_at, run.ended_at
  FROM pilot_run AS run
  JOIN story ON story.id = run.story_id
`

const LIVE_CLAUSE = "run.state IN ('running', 'paused')"

export function toAct(row: ActRow): PilotAct {
  return {
    id: row.id,
    position: row.position,
    kind: row.kind as PilotAct['kind'],
    target: row.target,
    value: row.value,
    outcome: row.outcome as PilotAct['outcome'],
    detail: row.detail,
    screenshotPath: row.screenshot_path,
    actedAt: row.acted_at,
  }
}

export function preparePilotStatements(db: Database.Database) {
  return {
    insertRun: db.prepare<[number, string, string, string]>(
      'INSERT INTO pilot_run (story_id, url, pace, script) VALUES (?, ?, ?, ?)',
    ),
    insertAct: db.prepare<[number, number, string, string | null, string | null, string, string, string | null]>(
      `INSERT INTO pilot_act (pilot_run_id, position, kind, target, value, outcome, detail, screenshot_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    selectLiveForStory: db.prepare<[number], RunRow>(`${RUN_SELECTION} WHERE run.story_id = ? AND ${LIVE_CLAUSE}`),
    selectLive: db.prepare<[], RunRow>(`${RUN_SELECTION} WHERE ${LIVE_CLAUSE} ORDER BY run.id ASC`),
    selectForStory: db.prepare<[number], RunRow>(`${RUN_SELECTION} WHERE run.story_id = ? ORDER BY run.id DESC`),
    selectRun: db.prepare<[number], RunRow>(`${RUN_SELECTION} WHERE run.id = ?`),
    selectActs: db.prepare<[number], ActRow>('SELECT * FROM pilot_act WHERE pilot_run_id = ? ORDER BY position ASC'),
    moveCursor: db.prepare<[number, number]>('UPDATE pilot_run SET position = ? WHERE id = ?'),
    changeState: db.prepare<[string, number]>('UPDATE pilot_run SET state = ? WHERE id = ?'),
    endRun: db.prepare<[string, number]>("UPDATE pilot_run SET state = ?, ended_at = datetime('now') WHERE id = ?"),
  }
}
