import type Database from 'better-sqlite3'
import type { ProjectRisk, RiskPatch, WeatherChange } from '../../../../contract/FollowUpContract.js'
import { EpicNotFoundError, ProjectNotFoundError } from '../Story/StoryViolation.js'
import { RiskEpicOutsideProjectError, RiskNotFoundError } from './FollowUpViolation.js'
import { toRisk, type FollowUpStatements, type ProjectRow, type RiskRow } from './FollowUpStatements.js'

const columnsOfPatch = {
  text: 'text',
  level: 'level',
  owner: 'owner',
  epicId: 'epic_id',
} as const

function blankToNull(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

export function createFollowUpWrites(
  db: Database.Database,
  { selectProject, selectRisk, selectEpic, updateWeather, updateSentence }: FollowUpStatements,
) {
  function assertProject(projectId: number): ProjectRow {
    const row = selectProject.get(projectId)
    if (row === undefined) {
      throw new ProjectNotFoundError(projectId)
    }
    return row
  }

  function assertEpicInProject(epicId: number, projectId: number): void {
    const epic = selectEpic.get(epicId)
    if (epic === undefined || epic.deleted_at !== null) {
      throw new EpicNotFoundError(epicId)
    }
    if (epic.project_id !== projectId) {
      throw new RiskEpicOutsideProjectError(epicId, projectId)
    }
  }

  function findRisk(riskId: number): RiskRow {
    const row = selectRisk.get(riskId)
    if (row === undefined) {
      throw new RiskNotFoundError(riskId)
    }
    return row
  }

  const writeRisk = db.transaction((riskId: number, patch: RiskPatch, today: string): ProjectRisk => {
    const current = findRisk(riskId)
    if (patch.epicId !== undefined && patch.epicId !== null) {
      assertEpicInProject(patch.epicId, current.project_id)
    }
    const assignments: string[] = []
    const values: (string | number | null)[] = []
    for (const [key, column] of Object.entries(columnsOfPatch)) {
      const value = patch[key as keyof typeof columnsOfPatch]
      if (value !== undefined) {
        assignments.push(`${column} = ?`)
        values.push(value)
      }
    }
    if (patch.closed === true && current.closed_on === null) {
      assignments.push('closed_on = ?')
      values.push(today)
    }
    if (patch.closed === false && current.closed_on !== null) {
      assignments.push('closed_on = NULL')
    }
    if (assignments.length > 0) {
      db.prepare(`UPDATE project_risk SET ${assignments.join(', ')} WHERE id = ?`).run(...values, riskId)
    }
    return toRisk(findRisk(riskId))
  })

  const writeWeather = db.transaction((projectId: number, change: WeatherChange): void => {
    assertProject(projectId)
    if (change.weather !== undefined) {
      updateWeather.run(change.weather, projectId)
    }
    if (change.statusSentence !== undefined) {
      updateSentence.run(change.statusSentence === null ? null : blankToNull(change.statusSentence), projectId)
    }
  })

  return { assertProject, assertEpicInProject, findRisk, writeRisk, writeWeather }
}
