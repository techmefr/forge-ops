import type { EpicPlanning } from '../../../../contract/EpicContract.js'
import type { Milestone } from '../../../../contract/StoryContract.js'
import { nextMilestone } from '../Board/CardAttention.js'
import { deriveEpicState, lateDaysOf } from './EpicPlan.js'
import {
  EMPTY_CENSUS,
  type CensusRow,
  type DependencyRow,
  type EpicReads,
  type EpicRow,
  type EpicTagRow,
  type EventRow,
  type HistoryRow,
  type LinkRow,
  type MilestoneRow,
} from './EpicStatements.js'

export type OverviewOptions = {
  today?: string
  deleted?: boolean
}

type ProjectIndex = {
  census: ReadonlyMap<number, CensusRow>
  tags: ReadonlyMap<number, EpicTagRow[]>
  links: ReadonlyMap<number, LinkRow[]>
  dependencies: ReadonlyMap<number, DependencyRow[]>
  milestones: ReadonlyMap<number, MilestoneRow[]>
  history: ReadonlyMap<number, HistoryRow[]>
  upcoming: ReadonlyMap<number, EventRow[]>
}

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

export function todayOf(now: string): string {
  return now.slice(0, 10)
}

export function createEpicPlanningReader(reads: EpicReads, now: () => string) {
  function indexProject(projectId: number, today: string): ProjectIndex {
    return {
      census: new Map(reads.selectCensusOfProject.all(projectId).map((row) => [row.epic_id, row])),
      tags: groupBy(reads.selectTagsOfProject.all(projectId), (row) => row.epic_id),
      links: groupBy(reads.selectLinksOfProject.all(projectId), (row) => row.owner_id),
      dependencies: groupBy(reads.selectDependenciesOfProject.all(projectId), (row) => row.epic_id),
      milestones: groupBy(reads.selectMilestonesOfProject.all(projectId), (row) => row.epic_id),
      history: groupBy(reads.selectHistoryOfProject.all(projectId), (row) => row.epic_id),
      upcoming: groupBy(reads.selectEventsOfProject.all(projectId, today), (row) => row.epic_id),
    }
  }

  function waitingOn(dependsOn: readonly number[]): EpicPlanning['waitingOn'] {
    return dependsOn.flatMap((dependencyId) => {
      const dependency = reads.selectEpic.get(dependencyId)
      if (dependency === undefined || dependency.deleted_at !== null) {
        return []
      }
      const census = reads.selectCensusOfEpic.get(dependencyId) ?? { epic_id: dependencyId, ...EMPTY_CENSUS }
      return deriveEpicState(census, false, dependency.manual_state) === 'done'
        ? []
        : [{ id: dependency.id, title: dependency.title }]
    })
  }

  function planningOfRow(epic: EpicRow, index: ProjectIndex, today: string): EpicPlanning {
    const counts = index.census.get(epic.id) ?? { epic_id: epic.id, ...EMPTY_CENSUS }
    const state = deriveEpicState(counts, epic.deleted_at !== null, epic.manual_state)
    const dated: Milestone[] = (index.milestones.get(epic.id) ?? []).map((row) => ({
      epicId: row.epic_id,
      kind: row.kind,
      dueOn: row.due_on,
    }))
    const blockedRow = [...(index.history.get(epic.id) ?? [])].reverse().find((row) => row.state === 'blocked')
    const dependsOn = (index.dependencies.get(epic.id) ?? []).map((row) => row.depends_on_epic_id)
    return {
      priority: epic.priority,
      startedOn: epic.started_on,
      statusNote: epic.status_note,
      requestedBy: epic.requested_by,
      tags: (index.tags.get(epic.id) ?? []).map(({ id, label, colour, usage }) => ({ id, label, colour, usage })),
      links: (index.links.get(epic.id) ?? []).map(({ kind, url }) => ({ kind, url })),
      dependsOn,
      state,
      progress: { delivered: counts.delivered, total: counts.total },
      lateDays: lateDaysOf(dated, state, today),
      dueOn: nextMilestone(dated, today)?.dueOn ?? null,
      nextEvent: nextEventOf(index.upcoming.get(epic.id) ?? []),
      blockedSince: state === 'blocked' ? (blockedRow?.at ?? null) : null,
      waitingOn: waitingOn(dependsOn),
      deletedAt: epic.deleted_at,
    }
  }

  function planningOf(
    projectId: number,
    { today = todayOf(now()), deleted = false }: OverviewOptions = {},
  ): ReadonlyMap<number, EpicPlanning> {
    const epics = reads.selectEpicsOfProject.all(projectId, deleted ? 1 : 0)
    const index = indexProject(projectId, today)
    return new Map(epics.map((epic) => [epic.id, planningOfRow(epic, index, today)]))
  }

  return { planningOf }
}
