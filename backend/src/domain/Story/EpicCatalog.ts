import type Database from 'better-sqlite3'
import type { EpicCreate, EpicPatch, EpicQuery, ManualEpicState } from '../../../../contract/EpicContract.js'
import { matchesQuery } from '../../../../contract/SubjectQuery.js'
import type { Epic, EpicDraft, EpicOverview } from './Story.js'
import type { EpicRepository, OverviewOptions } from '../Epic/EpicRepository.js'
import { InactiveAssigneeError } from '../Epic/EpicViolation.js'
import type { ProjectCatalog } from './ProjectCatalog.js'
import { EpicNotFoundError, EpicTakenError, ProjectNotFoundError } from './StoryViolation.js'

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

export function createEpicCatalog(
  db: Database.Database,
  { epics, projects }: { epics: EpicRepository; projects: ProjectCatalog },
): EpicCatalog {
  const insertEpic = db.prepare<[number, string, string]>(
    'INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)',
  )
  const selectEpics = db.prepare<
    [number, number],
    {
      id: number
      project_id: number
      title: string
      business_intent: string
      assignee: string | null
      story_count: number
    }
  >(
    `SELECT epic.id, epic.project_id, epic.title, epic.business_intent, epic.assignee,
            COUNT(story.id) AS story_count
       FROM epic
       LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
      WHERE epic.project_id = ? AND (epic.deleted_at IS NOT NULL) = ?
      GROUP BY epic.id
      ORDER BY epic.id`,
  )
  const selectEpicById = db.prepare<[number], { id: number; project_id: number; assignee: string | null }>(
    'SELECT id, project_id, assignee FROM epic WHERE id = ?',
  )
  const updateEpicAssignee = db.prepare<[string | null, number]>('UPDATE epic SET assignee = ? WHERE id = ?')
  const selectDisabledAt = db.prepare<[string], { disabled_at: string | null }>(
    'SELECT disabled_at FROM board_user WHERE login = ?',
  )
  const selectProjectById = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectFullEpic = db.prepare<
    [number],
    { id: number; project_id: number; title: string; business_intent: string }
  >('SELECT id, project_id, title, business_intent FROM epic WHERE id = ?')

  function epicsOfProject(projectId: number, options: OverviewOptions = {}): readonly EpicOverview[] {
    const planning = epics.planningOf(projectId, options)
    return selectEpics.all(projectId, options.deleted === true ? 1 : 0).flatMap((row) => {
      const planned = planning.get(row.id)
      return planned === undefined
        ? []
        : [
            {
              id: row.id,
              projectId: row.project_id,
              title: row.title,
              businessIntent: row.business_intent,
              assignee: row.assignee,
              storyCount: row.story_count,
              ...planned,
            },
          ]
    })
  }

  function assertAssignable(login: string): void {
    if ((selectDisabledAt.get(login)?.disabled_at ?? null) !== null) {
      throw new InactiveAssigneeError(login)
    }
  }

  function assertHeldBy(epicId: number, login: string): { assignee: string | null } {
    const epic = selectEpicById.get(epicId)
    if (epic === undefined) {
      throw new EpicNotFoundError(epicId)
    }
    if (epic.assignee !== null && epic.assignee !== login) {
      throw new EpicTakenError(epicId, epic.assignee)
    }
    return epic
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

    createSubject: (draft, by) => {
      const { assignee = null, businessIntent, ...planning } = draft
      return createSubjectAtomically(
        { assignee, businessIntent: businessIntent === undefined || businessIntent === '' ? draft.title : businessIntent, planning },
        by,
      )
    },

    assignEpic: (epicId, login) => {
      if (selectEpicById.get(epicId) === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      if (login !== null) {
        assertAssignable(login)
      }
      updateEpicAssignee.run(login, epicId)
    },

    claimEpic: db.transaction((epicId: number, login: string, state?: ManualEpicState) => {
      assertHeldBy(epicId, login)
      assertAssignable(login)
      updateEpicAssignee.run(login, epicId)
      if (state !== undefined) {
        epics.plan(epicId, { state }, login)
      }
    }),

    releaseEpic: db.transaction((epicId: number, login: string, state?: ManualEpicState) => {
      assertHeldBy(epicId, login)
      updateEpicAssignee.run(null, epicId)
      if (state !== undefined) {
        epics.plan(epicId, { state }, login)
      }
    }),

    listEpics: epicsOfProject,

    listEveryEpic: (query, today) =>
      projects
        .listProjects()
        .flatMap((project) => epicsOfProject(project.id, { today, deleted: query.state === 'trash' }))
        .filter((epic) => matchesQuery(epic, query)),

    assigneeOf: (epicId) => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return epic.assignee
    },

    findEpic: (epicId) => {
      const row = selectFullEpic.get(epicId)
      if (row === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        businessIntent: row.business_intent,
      }
    },
  }
}
