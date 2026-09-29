import type Database from 'better-sqlite3'
import type {
  DecisionDraft,
  ProjectDecision,
  ProjectFollowUp,
  ProjectRisk,
  RiskDraft,
  RiskLevel,
  RiskPatch,
  Weather,
  WeatherChange,
} from '../../../../contract/FollowUpContract.js'
import { minutesToWrite } from '../../../../contract/EventContract.js'
import type { EpicRepository } from '../Epic/EpicRepository.js'
import type { EventRepository } from '../Event/EventRepository.js'
import { EpicNotFoundError, ProjectNotFoundError } from '../Story/StoryViolation.js'
import { RiskEpicOutsideProjectError, RiskNotFoundError } from './FollowUpViolation.js'
import { scoreOf, weatherOf } from './Weather.js'

export type FollowUpRepository = {
  followUp: (projectId: number, today: string) => ProjectFollowUp
  openRisk: (projectId: number, draft: RiskDraft, today: string) => ProjectRisk
  updateRisk: (riskId: number, patch: RiskPatch, today: string) => ProjectRisk
  recordDecision: (projectId: number, draft: DecisionDraft, decider: string, today: string) => ProjectDecision
  changeWeather: (projectId: number, change: WeatherChange) => void
  projectOfRisk: (riskId: number) => number
}

export type FollowUpRepositoryInput = {
  epics: EpicRepository
  agenda: EventRepository
}

type RiskRow = {
  id: number
  project_id: number
  text: string
  level: RiskLevel
  owner: string | null
  epic_id: number | null
  opened_on: string
  closed_on: string | null
}

type DecisionRow = {
  id: number
  project_id: number
  decided_on: string
  text: string
  decided_by: string
}

type ProjectRow = {
  status_sentence: string | null
  weather_override: Weather | null
}

const RISK_COLUMNS = 'id, project_id, text, level, owner, epic_id, opened_on, closed_on'

function toRisk(row: RiskRow): ProjectRisk {
  return {
    id: row.id,
    projectId: row.project_id,
    text: row.text,
    level: row.level,
    owner: row.owner,
    epicId: row.epic_id,
    openedOn: row.opened_on,
    closedOn: row.closed_on,
  }
}

function toDecision(row: DecisionRow): ProjectDecision {
  return {
    id: row.id,
    projectId: row.project_id,
    decidedOn: row.decided_on,
    text: row.text,
    decidedBy: row.decided_by,
  }
}

function blankToNull(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

export function createFollowUpRepository(
  db: Database.Database,
  { epics, agenda }: FollowUpRepositoryInput,
): FollowUpRepository {
  const selectProject = db.prepare<[number], ProjectRow>(
    'SELECT status_sentence, weather_override FROM project WHERE id = ?',
  )
  const selectRisksOfProject = db.prepare<[number], RiskRow>(
    `SELECT ${RISK_COLUMNS} FROM project_risk WHERE project_id = ?
      ORDER BY closed_on IS NOT NULL,
               CASE level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               id DESC`,
  )
  const selectRisk = db.prepare<[number], RiskRow>(`SELECT ${RISK_COLUMNS} FROM project_risk WHERE id = ?`)
  const selectDecisionsOfProject = db.prepare<[number], DecisionRow>(
    `SELECT id, project_id, decided_on, text, decided_by FROM project_decision
      WHERE project_id = ? ORDER BY decided_on DESC, id DESC`,
  )
  const selectDecision = db.prepare<[number], DecisionRow>(
    'SELECT id, project_id, decided_on, text, decided_by FROM project_decision WHERE id = ?',
  )
  const selectEpic = db.prepare<[number], { project_id: number; deleted_at: string | null }>(
    'SELECT project_id, deleted_at FROM epic WHERE id = ?',
  )
  const insertRisk = db.prepare<[number, string, RiskLevel, string | null, number | null, string]>(
    `INSERT INTO project_risk (project_id, text, level, owner, epic_id, opened_on) VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const insertDecision = db.prepare<[number, string, string, string]>(
    'INSERT INTO project_decision (project_id, decided_on, text, decided_by) VALUES (?, ?, ?, ?)',
  )
  const updateWeather = db.prepare<[Weather | null, number]>('UPDATE project SET weather_override = ? WHERE id = ?')
  const updateSentence = db.prepare<[string | null, number]>('UPDATE project SET status_sentence = ? WHERE id = ?')

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

  const columnsOfPatch = {
    text: 'text',
    level: 'level',
    owner: 'owner',
    epicId: 'epic_id',
  } as const

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

  return {
    followUp: (projectId, today) => {
      const project = assertProject(projectId)
      const planning = [...epics.planningOf(projectId, { today }).values()]
      const risks = selectRisksOfProject.all(projectId).map(toRisk)
      const events = agenda.listOfProject(projectId)
      const late = planning.filter((entry) => entry.lateDays !== null && entry.lateDays > 0).length
      const blocked = planning.filter((entry) => entry.state === 'blocked').length
      const highRisks = risks.filter((entry) => entry.level === 'high' && entry.closedOn === null).length
      const score = scoreOf(late, blocked, highRisks)
      return {
        projectId,
        statusSentence: project.status_sentence,
        ...weatherOf(score, project.weather_override),
        score,
        alerts: {
          late,
          blocked,
          highRisks,
          minutesToWrite: events.filter((event) => minutesToWrite(event, today)).length,
        },
        nextEvent: events.find((event) => event.date >= today) ?? null,
        risks,
        decisions: selectDecisionsOfProject.all(projectId).map(toDecision),
        events,
      }
    },

    openRisk: (projectId, draft, today) => {
      assertProject(projectId)
      if (draft.epicId !== null) {
        assertEpicInProject(draft.epicId, projectId)
      }
      const info = insertRisk.run(projectId, draft.text, draft.level, draft.owner, draft.epicId, today)
      return toRisk(findRisk(Number(info.lastInsertRowid)))
    },

    updateRisk: (riskId, patch, today) => writeRisk(riskId, patch, today),

    recordDecision: (projectId, draft, decider, today) => {
      assertProject(projectId)
      const info = insertDecision.run(projectId, draft.decidedOn ?? today, draft.text, draft.decidedBy ?? decider)
      const row = selectDecision.get(Number(info.lastInsertRowid))
      if (row === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      return toDecision(row)
    },

    changeWeather: (projectId, change) => writeWeather(projectId, change),

    projectOfRisk: (riskId) => findRisk(riskId).project_id,
  }
}
