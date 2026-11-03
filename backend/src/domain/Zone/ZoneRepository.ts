import type Database from 'better-sqlite3'
import type { Zone, ZoneDraft, ZoneFile, ZoneOverview } from './Zone.js'
import { prepareZoneStatements, type FileRow, type ZoneRow } from './ZoneStatements.js'
import { ZoneNotFoundError, ZonePrefixRequiredError } from './ZoneViolation.js'

export type ZoneRepository = {
  declareZone: (draft: ZoneDraft) => Zone
  summariseZone: (projectId: number, pathPrefix: string, summary: string) => Zone
  findZone: (projectId: number, pathPrefix: string) => Zone
  listZones: (projectId: number) => readonly Zone[]
  overview: (projectId: number) => readonly ZoneOverview[]
  overviewOfZone: (projectId: number, pathPrefix: string) => ZoneOverview
  zoneOfPath: (projectId: number, path: string) => Zone | null
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
  const { insertZone, selectZoneById, selectZoneByPrefix, selectZones, updateSummary, selectZoneFiles, selectLongestPrefix } = prepareZoneStatements(db)

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

    zoneOfPath: (projectId, path) => {
      const row = selectLongestPrefix.get(projectId, path)
      return row === undefined ? null : toZone(row)
    },
  }
}
