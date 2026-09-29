import type Database from 'better-sqlite3'
import {
  SYSTEM_AUTHOR,
  TRASH_RETENTION_DAYS,
  type EpicPatch,
  type EpicPlanning,
  type EpicState,
  type EpicStateChange,
  type ManualEpicState,
  type LinkKind,
  type SubjectLink,
  type Tag,
  type TagDraft,
} from '../../../../contract/EpicContract.js'
import type { Milestone, MilestoneKind } from '../../../../contract/StoryContract.js'
import { nextMilestone } from '../Board/CardAttention.js'
import { closesLoop, deriveEpicState, lateDaysOf, type StoryCensus } from './EpicPlan.js'
import {
  EpicDependencyLoopError,
  EpicNotDeletedError,
  EpicSelfDependencyError,
  EpicStateDerivedError,
  TagInUseError,
  TagLabelTakenError,
  TagNotFoundError,
} from './EpicViolation.js'
import { EpicNotFoundError, ProjectNotFoundError } from '../Story/StoryViolation.js'

const DAY_MS = 86400000

export type OverviewOptions = {
  today?: string
  deleted?: boolean
}

export type EpicRepository = {
  recordState: (epicId: number, by?: string) => void
  planningOf: (projectId: number, options?: OverviewOptions) => ReadonlyMap<number, EpicPlanning>
  planningOfEpic: (epicId: number, today?: string) => EpicPlanning
  plan: (epicId: number, patch: EpicPatch, by?: string) => void
  history: (epicId: number) => readonly EpicStateChange[]
  softDelete: (epicId: number, login: string) => void
  restore: (epicId: number, login: string) => void
  purgeExpired: () => number
  listTags: () => readonly Tag[]
  createTag: (draft: TagDraft) => Tag
  updateTag: (tagId: number, draft: TagDraft) => Tag
  deleteTag: (tagId: number) => void
  projectLinks: (projectId: number) => readonly SubjectLink[]
  setProjectLinks: (projectId: number, links: readonly SubjectLink[]) => void
}

export type EpicRepositoryOptions = {
  now?: () => string
}

type EpicRow = {
  id: number
  project_id: number
  title: string
  priority: EpicPlanning['priority']
  started_on: string | null
  status_note: string | null
  requested_by: string | null
  deleted_at: string | null
  manual_state: ManualEpicState | null
}

type CensusRow = { epic_id: number; total: number; delivered: number; started: number; blocked: number }
type TagRow = { id: number; label: string; colour: string; usage: number }
type EpicTagRow = TagRow & { epic_id: number }
type LinkRow = { owner_id: number; kind: LinkKind; url: string }
type DependencyRow = { epic_id: number; depends_on_epic_id: number }
type MilestoneRow = { epic_id: number; kind: MilestoneKind; due_on: string }
type EventRow = { epic_id: number; kind: MilestoneKind; due_on: string; title: string }
type HistoryRow = { epic_id: number; state: EpicState; at: string; by: string }

const EMPTY_CENSUS: StoryCensus = { total: 0, delivered: 0, started: 0, blocked: 0 }

const CENSUS_COLUMNS = `COUNT(story.id) AS total,
            COALESCE(SUM(story.state = 'done'), 0) AS delivered,
            COALESCE(SUM(story.state NOT IN ('drafting', 'backlog', 'done')), 0) AS started,
            COALESCE(SUM(story.state <> 'done' AND (story.blocked_reason IS NOT NULL OR story.state = 'escalated')), 0) AS blocked`

function groupBy<Row, Key>(rows: readonly Row[], keyOf: (row: Row) => Key): Map<Key, Row[]> {
  const grouped = new Map<Key, Row[]>()
  for (const row of rows) {
    const key = keyOf(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return grouped
}

function nextEventOf(rows: readonly EventRow[]): EpicPlanning['nextEvent'] {
  const first = rows[0]
  return first === undefined ? null : { type: first.kind, date: first.due_on, title: first.title }
}

function todayOf(now: string): string {
  return now.slice(0, 10)
}

export function createEpicRepository(
  db: Database.Database,
  { now = () => new Date().toISOString() }: EpicRepositoryOptions = {},
): EpicRepository {
  const selectEpic = db.prepare<[number], EpicRow>(
    `SELECT id, project_id, title, priority, started_on, status_note, requested_by, deleted_at, manual_state
       FROM epic WHERE id = ?`,
  )
  const selectEpicsOfProject = db.prepare<[number, number], EpicRow>(
    `SELECT id, project_id, title, priority, started_on, status_note, requested_by, deleted_at, manual_state
       FROM epic WHERE project_id = ? AND (deleted_at IS NOT NULL) = ? ORDER BY id`,
  )
  const selectCensusOfProject = db.prepare<[number], CensusRow>(
    `SELECT epic.id AS epic_id, ${CENSUS_COLUMNS}
       FROM epic
       LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
      WHERE epic.project_id = ?
      GROUP BY epic.id`,
  )
  const selectCensusOfEpic = db.prepare<[number], CensusRow>(
    `SELECT epic.id AS epic_id, ${CENSUS_COLUMNS}
       FROM epic
       LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
      WHERE epic.id = ?
      GROUP BY epic.id`,
  )
  const selectTagsOfProject = db.prepare<[number], EpicTagRow>(
    `SELECT epic_tag.epic_id AS epic_id, tag.id AS id, tag.label AS label, tag.colour AS colour,
            (SELECT COUNT(*) FROM epic_tag AS used WHERE used.tag_id = tag.id) AS usage
       FROM epic_tag
       JOIN tag ON tag.id = epic_tag.tag_id
       JOIN epic ON epic.id = epic_tag.epic_id
      WHERE epic.project_id = ?
      ORDER BY tag.label`,
  )
  const selectLinksOfProject = db.prepare<[number], LinkRow>(
    `SELECT epic_link.epic_id AS owner_id, epic_link.kind AS kind, epic_link.url AS url
       FROM epic_link JOIN epic ON epic.id = epic_link.epic_id
      WHERE epic.project_id = ? ORDER BY epic_link.id`,
  )
  const selectDependenciesOfProject = db.prepare<[number], DependencyRow>(
    `SELECT epic_dependency.epic_id, epic_dependency.depends_on_epic_id
       FROM epic_dependency JOIN epic ON epic.id = epic_dependency.epic_id
      WHERE epic.project_id = ? ORDER BY epic_dependency.depends_on_epic_id`,
  )
  const selectEveryDependency = db.prepare<[], DependencyRow>(
    'SELECT epic_id, depends_on_epic_id FROM epic_dependency',
  )
  const selectMilestonesOfProject = db.prepare<[number], MilestoneRow>(
    `SELECT epic_milestone.epic_id, epic_milestone.kind, epic_milestone.due_on
       FROM epic_milestone JOIN epic ON epic.id = epic_milestone.epic_id
      WHERE epic.project_id = ? AND epic_milestone.kind IN ('demo', 'production', 'everyone')`,
  )
  const selectEventsOfProject = db.prepare<[number, string], EventRow>(
    `SELECT epic_milestone.epic_id, epic_milestone.kind, epic_milestone.due_on, epic_milestone.title
       FROM epic_milestone JOIN epic ON epic.id = epic_milestone.epic_id
      WHERE epic.project_id = ? AND epic_milestone.due_on >= ?
      ORDER BY epic_milestone.due_on, epic_milestone.id`,
  )
  const selectHistoryOfProject = db.prepare<[number], HistoryRow>(
    `SELECT epic_state_history.epic_id, epic_state_history.state, epic_state_history.at, epic_state_history.by
       FROM epic_state_history JOIN epic ON epic.id = epic_state_history.epic_id
      WHERE epic.project_id = ? ORDER BY epic_state_history.id`,
  )
  const selectHistory = db.prepare<[number], HistoryRow>(
    'SELECT epic_id, state, at, by FROM epic_state_history WHERE epic_id = ? ORDER BY id',
  )
  const selectLastState = db.prepare<[number], { state: EpicState }>(
    'SELECT state FROM epic_state_history WHERE epic_id = ? ORDER BY id DESC LIMIT 1',
  )
  const insertHistory = db.prepare<[number, EpicState, string, string]>(
    'INSERT INTO epic_state_history (epic_id, state, at, by) VALUES (?, ?, ?, ?)',
  )
  const selectProject = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectTag = db.prepare<[number], { id: number }>('SELECT id FROM tag WHERE id = ?')
  const selectTagByLabel = db.prepare<[string], { id: number }>('SELECT id FROM tag WHERE label = ?')
  const insertTag = db.prepare<[string, string]>('INSERT INTO tag (label, colour) VALUES (?, ?)')
  const updateTag = db.prepare<[string, string, number]>('UPDATE tag SET label = ?, colour = ? WHERE id = ?')
  const deleteTag = db.prepare<[number]>('DELETE FROM tag WHERE id = ?')
  const selectTags = db.prepare<[], TagRow>(
    `SELECT tag.id, tag.label, tag.colour, COUNT(epic_tag.epic_id) AS usage
       FROM tag LEFT JOIN epic_tag ON epic_tag.tag_id = tag.id
      GROUP BY tag.id ORDER BY tag.label`,
  )
  const selectTagById = db.prepare<[number], TagRow>(
    `SELECT tag.id, tag.label, tag.colour, COUNT(epic_tag.epic_id) AS usage
       FROM tag LEFT JOIN epic_tag ON epic_tag.tag_id = tag.id
      WHERE tag.id = ? GROUP BY tag.id`,
  )
  const deleteEpicTags = db.prepare<[number]>('DELETE FROM epic_tag WHERE epic_id = ?')
  const insertEpicTag = db.prepare<[number, number]>('INSERT INTO epic_tag (epic_id, tag_id) VALUES (?, ?)')
  const deleteEpicLinks = db.prepare<[number]>('DELETE FROM epic_link WHERE epic_id = ?')
  const insertEpicLink = db.prepare<[number, LinkKind, string]>(
    'INSERT INTO epic_link (epic_id, kind, url) VALUES (?, ?, ?)',
  )
  const deleteProjectLinks = db.prepare<[number]>('DELETE FROM project_link WHERE project_id = ?')
  const insertProjectLink = db.prepare<[number, LinkKind, string]>(
    'INSERT INTO project_link (project_id, kind, url) VALUES (?, ?, ?)',
  )
  const selectProjectLinks = db.prepare<[number], { kind: LinkKind; url: string }>(
    'SELECT kind, url FROM project_link WHERE project_id = ? ORDER BY id',
  )
  const deleteOwnDependencies = db.prepare<[number]>('DELETE FROM epic_dependency WHERE epic_id = ?')
  const insertDependency = db.prepare<[number, number]>(
    'INSERT INTO epic_dependency (epic_id, depends_on_epic_id) VALUES (?, ?)',
  )
  const updateManualState = db.prepare<[ManualEpicState, number]>(
    'UPDATE epic SET manual_state = ? WHERE id = ?',
  )
  const markDeleted = db.prepare<[string | null, number]>('UPDATE epic SET deleted_at = ? WHERE id = ?')
  const selectExpired = db.prepare<[string], { id: number }>(
    `SELECT epic.id FROM epic
      WHERE epic.deleted_at IS NOT NULL AND epic.deleted_at <= ?
        AND NOT EXISTS (SELECT 1 FROM story WHERE story.epic_id = epic.id)`,
  )

  const scalarColumns = {
    priority: 'priority',
    startedOn: 'started_on',
    statusNote: 'status_note',
    requestedBy: 'requested_by',
  } as const

  function liveEpic(epicId: number): EpicRow {
    const row = selectEpic.get(epicId)
    if (row === undefined || row.deleted_at !== null) {
      throw new EpicNotFoundError(epicId)
    }
    return row
  }

  function anyEpic(epicId: number): EpicRow {
    const row = selectEpic.get(epicId)
    if (row === undefined) {
      throw new EpicNotFoundError(epicId)
    }
    return row
  }

  function recordState(epicId: number, by: string = SYSTEM_AUTHOR): void {
    const epic = selectEpic.get(epicId)
    if (epic === undefined) {
      return
    }
    const census = selectCensusOfEpic.get(epicId) ?? { epic_id: epicId, ...EMPTY_CENSUS }
    const state = deriveEpicState(census, epic.deleted_at !== null, epic.manual_state)
    if (selectLastState.get(epicId)?.state === state) {
      return
    }
    insertHistory.run(epicId, state, now(), by)
  }

  function planningOf(
    projectId: number,
    { today = todayOf(now()), deleted = false }: OverviewOptions = {},
  ): ReadonlyMap<number, EpicPlanning> {
    const epics = selectEpicsOfProject.all(projectId, deleted ? 1 : 0)
    const census = new Map(selectCensusOfProject.all(projectId).map((row) => [row.epic_id, row]))
    const tags = groupBy(selectTagsOfProject.all(projectId), (row) => row.epic_id)
    const links = groupBy(selectLinksOfProject.all(projectId), (row) => row.owner_id)
    const dependencies = groupBy(selectDependenciesOfProject.all(projectId), (row) => row.epic_id)
    const milestones = groupBy(selectMilestonesOfProject.all(projectId), (row) => row.epic_id)
    const history = groupBy(selectHistoryOfProject.all(projectId), (row) => row.epic_id)
    const upcoming = groupBy(selectEventsOfProject.all(projectId, today), (row) => row.epic_id)
    const planning = new Map<number, EpicPlanning>()
    for (const epic of epics) {
      const counts = census.get(epic.id) ?? { epic_id: epic.id, ...EMPTY_CENSUS }
      const state = deriveEpicState(counts, epic.deleted_at !== null, epic.manual_state)
      const dated: Milestone[] = (milestones.get(epic.id) ?? []).map((row) => ({
        epicId: row.epic_id,
        kind: row.kind,
        dueOn: row.due_on,
      }))
      const changes = history.get(epic.id) ?? []
      const blockedRow = [...changes].reverse().find((row) => row.state === 'blocked')
      const dependsOn = (dependencies.get(epic.id) ?? []).map((row) => row.depends_on_epic_id)
      planning.set(epic.id, {
        priority: epic.priority,
        startedOn: epic.started_on,
        statusNote: epic.status_note,
        requestedBy: epic.requested_by,
        tags: (tags.get(epic.id) ?? []).map(({ id, label, colour, usage }) => ({ id, label, colour, usage })),
        links: (links.get(epic.id) ?? []).map(({ kind, url }) => ({ kind, url })),
        dependsOn,
        state,
        progress: { delivered: counts.delivered, total: counts.total },
        lateDays: lateDaysOf(dated, state, today),
        dueOn: nextMilestone(dated, today)?.dueOn ?? null,
        nextEvent: nextEventOf(upcoming.get(epic.id) ?? []),
        blockedSince: state === 'blocked' ? (blockedRow?.at ?? null) : null,
        waitingOn: dependsOn.flatMap((dependencyId) => {
          const dependency = selectEpic.get(dependencyId)
          if (dependency === undefined || dependency.deleted_at !== null) {
            return []
          }
          const dependencyCensus = selectCensusOfEpic.get(dependencyId) ?? { epic_id: dependencyId, ...EMPTY_CENSUS }
          return deriveEpicState(dependencyCensus, false, dependency.manual_state) === 'done'
            ? []
            : [{ id: dependency.id, title: dependency.title }]
        }),
        deletedAt: epic.deleted_at,
      })
    }
    return planning
  }

  function assertDependencies(epicId: number, dependsOn: readonly number[]): void {
    for (const target of dependsOn) {
      if (target === epicId) {
        throw new EpicSelfDependencyError(epicId)
      }
      liveEpic(target)
    }
    const edges = new Map<number, number[]>()
    for (const row of selectEveryDependency.all()) {
      if (row.epic_id !== epicId) {
        edges.set(row.epic_id, [...(edges.get(row.epic_id) ?? []), row.depends_on_epic_id])
      }
    }
    for (const target of dependsOn) {
      if (closesLoop(edges, epicId, [target])) {
        throw new EpicDependencyLoopError(epicId, target)
      }
    }
  }

  function writeScalars(epicId: number, patch: EpicPatch): void {
    const assignments: string[] = []
    const values: (string | null)[] = []
    for (const [key, column] of Object.entries(scalarColumns)) {
      const value = patch[key as keyof typeof scalarColumns]
      if (value !== undefined) {
        assignments.push(`${column} = ?`)
        values.push(value)
      }
    }
    if (assignments.length > 0) {
      db.prepare(`UPDATE epic SET ${assignments.join(', ')} WHERE id = ?`).run(...values, epicId)
    }
  }

  const writePlan = db.transaction((epicId: number, patch: EpicPatch, by: string) => {
    liveEpic(epicId)
    if (patch.state !== undefined && (selectCensusOfEpic.get(epicId)?.total ?? 0) > 0) {
      throw new EpicStateDerivedError(epicId)
    }
    const tagIds = [...new Set(patch.tagIds ?? [])]
    for (const tagId of tagIds) {
      if (selectTag.get(tagId) === undefined) {
        throw new TagNotFoundError(tagId)
      }
    }
    const dependsOn = [...new Set(patch.dependsOn ?? [])]
    if (patch.dependsOn !== undefined) {
      assertDependencies(epicId, dependsOn)
    }
    writeScalars(epicId, patch)
    if (patch.state !== undefined) {
      updateManualState.run(patch.state, epicId)
      recordState(epicId, by)
    }
    if (patch.tagIds !== undefined) {
      deleteEpicTags.run(epicId)
      tagIds.forEach((tagId) => insertEpicTag.run(epicId, tagId))
    }
    if (patch.links !== undefined) {
      deleteEpicLinks.run(epicId)
      patch.links.forEach((link) => insertEpicLink.run(epicId, link.kind, link.url))
    }
    if (patch.dependsOn !== undefined) {
      deleteOwnDependencies.run(epicId)
      dependsOn.forEach((target) => insertDependency.run(epicId, target))
    }
  })

  const purge = db.transaction((): number => {
    const cutoff = new Date(Date.parse(now()) - TRASH_RETENTION_DAYS * DAY_MS).toISOString()
    const expired = selectExpired.all(cutoff)
    for (const { id } of expired) {
      for (const table of ['epic_tag', 'epic_link', 'epic_state_history', 'epic_milestone']) {
        db.prepare(`DELETE FROM ${table} WHERE epic_id = ?`).run(id)
      }
      db.prepare('DELETE FROM epic_dependency WHERE epic_id = ? OR depends_on_epic_id = ?').run(id, id)
      db.prepare('DELETE FROM epic WHERE id = ?').run(id)
    }
    return expired.length
  })

  function assertLabelFree(label: string, ownId: number | null): void {
    const taken = selectTagByLabel.get(label)
    if (taken !== undefined && taken.id !== ownId) {
      throw new TagLabelTakenError(label)
    }
  }

  function tagById(tagId: number): Tag {
    const row = selectTagById.get(tagId)
    if (row === undefined) {
      throw new TagNotFoundError(tagId)
    }
    return { id: row.id, label: row.label, colour: row.colour, usage: row.usage }
  }

  return {
    recordState,
    planningOf,

    planningOfEpic: (epicId, today) => {
      const epic = anyEpic(epicId)
      const found = planningOf(epic.project_id, { today, deleted: epic.deleted_at !== null }).get(epicId)
      if (found === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return found
    },

    plan: (epicId, patch, by = SYSTEM_AUTHOR) => writePlan(epicId, patch, by),

    history: (epicId) => {
      anyEpic(epicId)
      return selectHistory.all(epicId).map(({ state, at, by }) => ({ state, at, by }))
    },

    softDelete: (epicId, login) => {
      liveEpic(epicId)
      markDeleted.run(now(), epicId)
      recordState(epicId, login)
    },

    restore: (epicId, login) => {
      if (anyEpic(epicId).deleted_at === null) {
        throw new EpicNotDeletedError(epicId)
      }
      markDeleted.run(null, epicId)
      recordState(epicId, login)
    },

    purgeExpired: () => purge(),

    listTags: () => selectTags.all().map(({ id, label, colour, usage }) => ({ id, label, colour, usage })),

    createTag: (draft) => {
      assertLabelFree(draft.label, null)
      const info = insertTag.run(draft.label, draft.colour)
      return tagById(Number(info.lastInsertRowid))
    },

    updateTag: (tagId, draft) => {
      tagById(tagId)
      assertLabelFree(draft.label, tagId)
      updateTag.run(draft.label, draft.colour, tagId)
      return tagById(tagId)
    },

    deleteTag: (tagId) => {
      const tag = tagById(tagId)
      if (tag.usage > 0) {
        throw new TagInUseError(tagId, tag.usage)
      }
      deleteTag.run(tagId)
    },

    projectLinks: (projectId) => {
      if (selectProject.get(projectId) === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      return selectProjectLinks.all(projectId)
    },

    setProjectLinks: (projectId, links) => {
      if (selectProject.get(projectId) === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      db.transaction(() => {
        deleteProjectLinks.run(projectId)
        links.forEach((link) => insertProjectLink.run(projectId, link.kind, link.url))
      })()
    },
  }
}
