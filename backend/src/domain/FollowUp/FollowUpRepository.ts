import type Database from 'better-sqlite3'
import type {
  DecisionDraft,
  ProjectDecision,
  ProjectFollowUp,
  ProjectRisk,
  RiskDraft,
  RiskPatch,
  WeatherChange,
} from '../../../../contract/FollowUpContract.js'
import { minutesToWrite } from '../../../../contract/EventContract.js'
import type { EpicRepository } from '../Epic/EpicRepository.js'
import type { EventRepository } from '../Event/EventRepository.js'
import { ProjectNotFoundError } from '../Story/StoryViolation.js'
import { prepareFollowUpStatements, toDecision, toRisk } from './FollowUpStatements.js'
import { createFollowUpWrites } from './FollowUpWrites.js'
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

export function createFollowUpRepository(
  db: Database.Database,
  { epics, agenda }: FollowUpRepositoryInput,
): FollowUpRepository {
  const statements = prepareFollowUpStatements(db)
  const { selectRisksOfProject, selectDecisionsOfProject, selectDecision, insertRisk, insertDecision } = statements
  const { assertProject, assertEpicInProject, findRisk, writeRisk, writeWeather } = createFollowUpWrites(db, statements)

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
