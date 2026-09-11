import type Database from 'better-sqlite3'
import type { Zone, ZoneDraft, ZoneFile, ZoneOverview } from './Zone.js'
import { ZoneNotFoundError, ZonePrefixRequiredError } from './ZoneViolation.js'

type ZoneRow = {
  id: number
  project_id: number
  path_prefix: string
  name: string
  colour: string
  summary: string | null
}

type FileRow = {
  path: string
  story_reference: string
  agent_name: string | null
}

export type ZoneRepository = {
  declareZone: (draft: ZoneDraft) => Zone
  summariseZone: (projectId: number, pathPrefix: string, summary: string) => Zone
  findZone: (projectId: number, pathPrefix: string) => Zone
  listZones: (projectId: number) => readonly Zone[]
  overview: (projectId: number) => readonly ZoneOverview[]
  overviewOfZone: (projectId: number, pathPrefix: string) => ZoneOverview
  zoneOfPath: (path: string) => Zone | null
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function toZone(row: ZoneRow): Zone {
  return {
    id: row.id,
    projectId: row.project_id,
    pathPrefix: row.path_prefix,
    name: row.name,
    colour: row.colour,
    summary: row.summary,
  }
}

function toFile(row: FileRow): ZoneFile {
  return {
    path: row.path,
    storyReference: row.story_reference,
    agentName: row.agent_name,
  }
}

export function createZoneRepository(db: Database.Database): ZoneRepository {
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
  const selectLongestPrefix = db.prepare<[string], ZoneRow>(
    `SELECT * FROM zone
      WHERE ? LIKE path_prefix || '%'
      ORDER BY LENGTH(path_prefix) DESC
      LIMIT 1`,
  )

  function findZone(projectId: number, pathPrefix: string): Zone {
    const row = selectZoneByPrefix.get(projectId, pathPrefix)
    if (row === undefined) {
      throw new ZoneNotFoundError(pathPrefix)
    }
    return toZone(row)
  }

  function overviewOfZone(projectId: number, pathPrefix: string): ZoneOverview {
    const zone = findZone(projectId, pathPrefix)
    const pattern = `${escapeLikePattern(zone.pathPrefix)}%`
    const files = selectZoneFiles.all(zone.projectId, pattern).map(toFile)
    return { zone, files, storyCount: new Set(files.map((file) => file.storyReference)).size }
  }

  return {
    declareZone: (draft) => {
      if (draft.pathPrefix.trim().length === 0) {
        throw new ZonePrefixRequiredError()
      }
      const info = insertZone.run(draft.projectId, draft.pathPrefix, draft.name, draft.colour)
      const row = selectZoneById.get(Number(info.lastInsertRowid))
      if (row === undefined) {
        throw new ZoneNotFoundError(draft.pathPrefix)
      }
      return toZone(row)
    },

    summariseZone: (projectId, pathPrefix, summary) => {
      findZone(projectId, pathPrefix)
      updateSummary.run(summary, projectId, pathPrefix)
      return findZone(projectId, pathPrefix)
    },

    findZone,

    listZones: (projectId) => selectZones.all(projectId).map(toZone),

    overview: (projectId) =>
      selectZones.all(projectId).map((row) => overviewOfZone(projectId, row.path_prefix)),

    overviewOfZone,

    zoneOfPath: (path) => {
      const row = selectLongestPrefix.get(path)
      return row === undefined ? null : toZone(row)
    },
  }
}
