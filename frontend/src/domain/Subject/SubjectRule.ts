import {
  SUBJECT_FILTERS,
  inSubjectFilter,
  type EpicPriority,
  type EpicState,
  type SubjectFilter,
} from '@contract/EpicContract'
import { matchesQuery } from '@contract/SubjectQuery'
import type { EpicOverview } from '@contract/StoryContract'

export const VIEW_ALL = '@all'
export const VIEW_LATE = '@late'
export const VIEW_NONE = '@none'

export const VIEWS: readonly string[] = [VIEW_ALL, VIEW_LATE, VIEW_NONE]

export type Facet = {
  project: number | null
  tag: number | null
  q: string
}

export type LoadTone = 'neutral' | 'full' | 'over'

export type Flags = {
  late: number
  blocked: number
}

export type ViewCounts = {
  all: number
  late: number
  none: number
}

export type DueKind = 'none' | 'date' | 'late' | 'today' | 'soon' | 'ahead'

export type DueBadge = {
  kind: DueKind
  days: number
}

const DAY_MS = 86400000
const SOON_DAYS = 3

const PRIORITY_RANK: Readonly<Record<EpicPriority, number>> = { max: 0, high: 1, normal: 2, low: 3 }

const OPEN_STATES: readonly EpicState[] = ['todo', 'doing', 'blocked']

const IN_PROGRESS: readonly EpicState[] = ['doing', 'blocked']

export function narrow(subjects: readonly EpicOverview[], facet: Facet): readonly EpicOverview[] {
  return subjects.filter((subject) =>
    matchesQuery(subject, {
      project: facet.project ?? undefined,
      tag: facet.tag ?? undefined,
      q: facet.q.trim() === '' ? undefined : facet.q,
    }),
  )
}

export function loadOf(subjects: readonly EpicOverview[], login: string): number {
  return subjects.filter((subject) => subject.assignee === login && IN_PROGRESS.includes(subject.state)).length
}

export function loadTone(load: number, capacity: number | null): LoadTone {
  if (capacity === null || load < capacity) {
    return 'neutral'
  }
  return load === capacity ? 'full' : 'over'
}

export function loadText(load: number, capacity: number | null): string {
  return capacity === null ? String(load) : `${load}/${capacity}`
}

export function flagsOf(subjects: readonly EpicOverview[], login: string): Flags {
  const mine = subjects.filter((subject) => subject.assignee === login && OPEN_STATES.includes(subject.state))
  return {
    late: mine.filter((subject) => subject.lateDays !== null).length,
    blocked: mine.filter((subject) => subject.state === 'blocked').length,
  }
}

function isUnassigned(subject: EpicOverview): boolean {
  return subject.assignee === null && OPEN_STATES.includes(subject.state)
}

export function viewCounts(live: readonly EpicOverview[]): ViewCounts {
  return {
    all: live.filter((subject) => inSubjectFilter(subject, 'open')).length,
    late: live.filter((subject) => subject.lateDays !== null).length,
    none: live.filter(isUnassigned).length,
  }
}

export function filterCounts(
  live: readonly EpicOverview[],
  trash: readonly EpicOverview[],
): Readonly<Record<SubjectFilter, number>> {
  return Object.fromEntries(
    SUBJECT_FILTERS.map((filter) => [
      filter,
      (filter === 'trash' ? trash : live).filter((subject) => inSubjectFilter(subject, filter)).length,
    ]),
  ) as Record<SubjectFilter, number>
}

export function sortSubjects(subjects: readonly EpicOverview[]): readonly EpicOverview[] {
  return [...subjects].sort(
    (one, other) =>
      Number(other.lateDays !== null) - Number(one.lateDays !== null) ||
      (other.lateDays ?? 0) - (one.lateDays ?? 0) ||
      Number(other.state === 'blocked') - Number(one.state === 'blocked') ||
      (one.dueOn ?? '9999-12-31').localeCompare(other.dueOn ?? '9999-12-31') ||
      PRIORITY_RANK[one.priority] - PRIORITY_RANK[other.priority] ||
      one.id - other.id,
  )
}

export function subjectsOfView(
  view: string,
  live: readonly EpicOverview[],
  trash: readonly EpicOverview[],
  filter: SubjectFilter,
): readonly EpicOverview[] {
  if (view === VIEW_ALL) {
    return sortSubjects((filter === 'trash' ? trash : live).filter((subject) => inSubjectFilter(subject, filter)))
  }
  if (view === VIEW_LATE) {
    return sortSubjects(live.filter((subject) => subject.lateDays !== null))
  }
  if (view === VIEW_NONE) {
    return sortSubjects(live.filter(isUnassigned))
  }
  return sortSubjects(live.filter((subject) => subject.assignee === view && OPEN_STATES.includes(subject.state)))
}

export function stepSelection(order: readonly string[], current: string, direction: 1 | -1): string {
  const index = order.indexOf(current)
  if (index === -1) {
    return order[0] ?? current
  }
  return order[(index + direction + order.length) % order.length] ?? current
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function dueBadge(dueOn: string | null, state: EpicState, today: string): DueBadge {
  if (state === 'done') {
    return { kind: 'date', days: 0 }
  }
  if (dueOn === null) {
    return { kind: 'none', days: 0 }
  }
  const left = daysBetween(today, dueOn)
  if (left < 0) {
    return { kind: 'late', days: -left }
  }
  if (left === 0) {
    return { kind: 'today', days: 0 }
  }
  return { kind: left <= SOON_DAYS ? 'soon' : 'ahead', days: left }
}

export function blockedDays(blockedSince: string | null, today: string): number | null {
  return blockedSince === null ? null : Math.max(0, daysBetween(blockedSince.slice(0, 10), today))
}
