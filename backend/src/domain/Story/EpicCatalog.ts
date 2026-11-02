import type Database from 'better-sqlite3'
import type { EpicCreate, EpicPatch, EpicQuery, ManualEpicState } from '../../../../contract/EpicContract.js'
import { matchesQuery } from '../../../../contract/SubjectQuery.js'
import type { Epic, EpicDraft, EpicOverview } from './Story.js'
import type { EpicRepository, OverviewOptions } from '../Epic/EpicRepository.js'
import type { ProjectCatalog } from './ProjectCatalog.js'
import { createEpicAssignment } from './EpicAssignment.js'
import { prepareEpicCatalogStatements } from './EpicCatalogStatements.js'
import { EpicNotFoundError, ProjectNotFoundError } from './StoryViolation.js'

export type EpicCatalog = {
  createEpic: (draft: EpicDraft) => Epic
  createSubject: (draft: EpicCreate, by: string) => Epic
  assignEpic: (epicId: number, login: string | null) => void
  claimEpic: (epicId: number, login: string, state?: ManualEpicState) => void
  releaseEpic: (epicId: number, login: string, state?: ManualEpicState) => void
  listEpics: (projectId: number, options?: OverviewOptions) => readonly EpicOverview[]
  listEveryEpic: (query: EpicQuery, today: string) => readonly EpicOverview[]
  assigneeOf: (epicId: number) => string | null
  findEpic: (epicId: number) => Epic
}

function toEpic(row: { id: number; project_id: number; title: string; business_intent: string }): Epic {
  return { id: row.id, projectId: row.project_id, title: row.title, businessIntent: row.business_intent }
}

function subjectInputOf(draft: EpicCreate) {
  const { assignee = null, businessIntent, ...planning } = draft
  return {
    assignee,
    businessIntent: businessIntent === undefined || businessIntent === '' ? draft.title : businessIntent,
    planning,
  }
}

export function createEpicCatalog(
  db: Database.Database,
  { epics, projects }: { epics: EpicRepository; projects: ProjectCatalog },
): EpicCatalog {
  const statements = prepareEpicCatalogStatements(db)
  const { insertEpic, selectEpics, updateEpicAssignee, selectProjectById, selectFullEpic } = statements
  const { assertAssignable, assignEpic, claimEpic, releaseEpic, assigneeOf } = createEpicAssignment(
    db,
    statements,
    epics,
  )

  function epicsOfProject(projectId: number, options: OverviewOptions = {}): readonly EpicOverview[] {
    const planning = epics.planningOf(projectId, options)
    return selectEpics.all(projectId, options.deleted === true ? 1 : 0).flatMap((row) => {
      const planned = planning.get(row.id)
      return planned === undefined
        ? []
        : [{ ...toEpic(row), assignee: row.assignee, storyCount: row.story_count, ...planned }]
    })
  }

  const createSubjectAtomically = db.transaction(
    (
      input: { assignee: string | null; businessIntent: string; planning: Omit<EpicCreate, 'assignee' | 'businessIntent'> },
      by: string,
    ): Epic => {
      const { projectId, title, ...fields } = input.planning
      if (selectProjectById.get(projectId) === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      if (input.assignee !== null) {
        assertAssignable(input.assignee)
      }
      const info = insertEpic.run(projectId, title, input.businessIntent)
      const id = Number(info.lastInsertRowid)
      epics.recordState(id, by)
      const patch: EpicPatch = { ...fields, ...(input.assignee === null ? {} : { state: 'doing' as const }) }
      epics.plan(id, patch, by)
      if (input.assignee !== null) {
        updateEpicAssignee.run(input.assignee, id)
      }
      return { id, projectId, title, businessIntent: input.businessIntent }
    },
  )

  return {
    createEpic: (draft) => {
      if (selectProjectById.get(draft.projectId) === undefined) {
        throw new ProjectNotFoundError(draft.projectId)
      }
      const info = insertEpic.run(draft.projectId, draft.title, draft.businessIntent)
      const id = Number(info.lastInsertRowid)
      epics.recordState(id)
      return { id, ...draft }
    },

    createSubject: (draft, by) => createSubjectAtomically(subjectInputOf(draft), by),

    assignEpic,
    claimEpic,
    releaseEpic,
    assigneeOf,
    listEpics: epicsOfProject,

    listEveryEpic: (query, today) =>
      projects
        .listProjects()
        .flatMap((project) => epicsOfProject(project.id, { today, deleted: query.state === 'trash' }))
        .filter((epic) => matchesQuery(epic, query)),

    findEpic: (epicId) => {
      const row = selectFullEpic.get(epicId)
      if (row === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return toEpic(row)
    },
  }
}
