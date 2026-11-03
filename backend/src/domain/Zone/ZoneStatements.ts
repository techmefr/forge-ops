import type Database from 'better-sqlite3'

export type ZoneRow = {
  id: number
  project_id: number
  path_prefix: string
  name: string
  colour: string
  summary: string | null
}

export type FileRow = {
  path: string
  story_reference: string
  agent_name: string | null
}

export type ZoneStatements = ReturnType<typeof prepareZoneStatements>

export function prepareZoneStatements(db: Database.Database) {
  const insertZone = db.prepare<[number, string, string, string]>(
    'INSERT INTO zone (project_id, path_prefix, name, colour) VALUES (?, ?, ?, ?)',
  )
  const selectZoneById = db.prepare<[number], ZoneRow>('SELECT * FROM zone WHERE id = ?')
  const selectZoneByPrefix = db.prepare<[number, string], ZoneRow>(
    'SELECT * FROM zone WHERE project_id = ? AND path_prefix = ?',
  )
  const selectZones = db.prepare<[number], ZoneRow>(
    'SELECT * FROM zone WHERE project_id = ? ORDER BY path_prefix',
  )
  const updateSummary = db.prepare<[string, number, string]>(
    "UPDATE zone SET summary = ?, summarised_at = datetime('now') WHERE project_id = ? AND path_prefix = ?",
  )
  const selectZoneFiles = db.prepare<[number, string], FileRow>(
    `SELECT DISTINCT file_touch.path AS path,
            story.reference AS story_reference,
            agent_session.agent_name AS agent_name
       FROM file_touch
       JOIN story ON story.id = file_touch.story_id
       JOIN epic ON epic.id = story.epic_id
       LEFT JOIN agent_session ON agent_session.id = file_touch.agent_session_id
      WHERE epic.project_id = ?
        AND file_touch.path LIKE ? ESCAPE '\\'
      ORDER BY file_touch.path`,
  )
  const selectLongestPrefix = db.prepare<[number, string], ZoneRow>(
    `SELECT * FROM zone
      WHERE project_id = ?
        AND SUBSTR(?, 1, LENGTH(path_prefix)) = path_prefix
      ORDER BY LENGTH(path_prefix) DESC
      LIMIT 1`,
  )

  return { insertZone, selectZoneById, selectZoneByPrefix, selectZones, updateSummary, selectZoneFiles, selectLongestPrefix }
}
