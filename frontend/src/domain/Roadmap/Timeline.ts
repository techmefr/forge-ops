import { DEADLINE_KINDS } from '@contract/StoryContract'
import type { EpicState } from '@contract/EpicContract'
import { minutesToWrite, type ProjectEvent } from '@contract/EventContract'

const DAY_MS = 86400000
const MINIMUM_SPAN_DAYS = 28
const WEEKLY_TICKS_UP_TO_DAYS = 120
const WINDOW_MARGIN_DAYS = 4
const LABEL_INSIDE_FROM_PERCENT = 14
const LABEL_FLIPS_FROM_PERCENT = 78
const LABEL_GAP_PERCENT = 0.6
const LANE_GAP_PERCENT = 9
const MONDAY = 1

export type RoadmapSubject = {
  id: number
  title: string
  assignee: string | null
  startedOn: string | null
  state: EpicState
}

export type TimelineWindow = {
  from: string
  to: string
}

export type SubjectBar = {
  start: string
  end: string
  milestoneId: number
  lateUntil: string | null
  lateDays: number
}

export type Extent = {
  left: number
  width: number
  lateWidth: number
}

export type LabelPlacement = { inside: true } | { inside: false; flip: boolean; at: number }

export type UpcomingEvent = {
  event: ProjectEvent
  daysLeft: number
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
}

function dayOfNumber(count: number): string {
  return new Date(count * DAY_MS).toISOString().slice(0, 10)
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

export function addDays(day: string, count: number): string {
  return dayOfNumber(dayNumber(day) + count)
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

export function localDay(moment: Date): string {
  return `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}`
}

function isLive(state: EpicState): boolean {
  return state !== 'done' && state !== 'trash'
}

function deadlinesOf(subject: RoadmapSubject, events: readonly ProjectEvent[]): readonly ProjectEvent[] {
  return events
    .filter(
      (event) =>
        event.epicId === subject.id && (DEADLINE_KINDS as readonly string[]).includes(event.type),
    )
    .sort((one, other) => one.date.localeCompare(other.date) || one.id - other.id)
}

export function barOf(
  subject: RoadmapSubject,
  events: readonly ProjectEvent[],
  today: string,
): SubjectBar | null {
  const deadlines = deadlinesOf(subject, events)
  const target = deadlines.find((event) => event.date >= today) ?? deadlines[deadlines.length - 1]
  if (subject.startedOn === null || target === undefined) {
    return null
  }
  const end = target.date < subject.startedOn ? subject.startedOn : target.date
  const late = isLive(subject.state) && end < today
  return {
    start: subject.startedOn,
    end,
    milestoneId: target.id,
    lateUntil: late ? today : null,
    lateDays: late ? daysBetween(end, today) : 0,
  }
}

export function subjectsWithoutDates(
  subjects: readonly RoadmapSubject[],
  events: readonly ProjectEvent[],
  today: string,
): readonly RoadmapSubject[] {
  return subjects.filter((subject) => isLive(subject.state) && barOf(subject, events, today) === null)
}

export function windowOf(days: readonly string[], today: string): TimelineWindow {
  const every = [...days, today].sort()
  let from = addDays(every[0] ?? today, -WINDOW_MARGIN_DAYS)
  let to = addDays(every[every.length - 1] ?? today, WINDOW_MARGIN_DAYS)
  const missing = MINIMUM_SPAN_DAYS - daysBetween(from, to)
  if (missing > 0) {
    from = addDays(from, -Math.floor(missing / 2))
    to = addDays(to, Math.ceil(missing / 2))
  }
  return { from, to }
}

export function percentOf(day: string, view: TimelineWindow): number {
  const span = daysBetween(view.from, view.to)
  const share = (daysBetween(view.from, day) / span) * 100
  return rounded(Math.max(0, Math.min(100, share)))
}

export function ticksOf(view: TimelineWindow): readonly string[] {
  const ticks: string[] = []
  const weekly = daysBetween(view.from, view.to) <= WEEKLY_TICKS_UP_TO_DAYS
  for (let day = view.from; day <= view.to; day = addDays(day, 1)) {
    const wanted = weekly
      ? new Date(`${day}T00:00:00Z`).getUTCDay() === MONDAY
      : day.endsWith('-01')
    if (wanted) {
      ticks.push(day)
    }
  }
  return ticks
}

export function extentOf(bar: SubjectBar, view: TimelineWindow): Extent {
  const left = percentOf(bar.start, view)
  const width = Math.max(1.2, rounded(percentOf(bar.end, view) - left + 1.1))
  const lateWidth =
    bar.lateUntil === null ? 0 : Math.max(0, rounded(percentOf(bar.lateUntil, view) - (left + width)))
  return { left, width, lateWidth }
}

export function labelPlacement({ left, width, lateWidth }: Extent): LabelPlacement {
  if (width >= LABEL_INSIDE_FROM_PERCENT) {
    return { inside: true }
  }
  const end = left + width + lateWidth
  if (end > LABEL_FLIPS_FROM_PERCENT) {
    return { inside: false, flip: true, at: rounded(100 - left + LABEL_GAP_PERCENT) }
  }
  return { inside: false, flip: false, at: rounded(end + LABEL_GAP_PERCENT) }
}

export function lanesOf(
  events: readonly ProjectEvent[],
  view: TimelineWindow,
): ReadonlyMap<number, number> {
  const lastAt: number[] = []
  const lanes = new Map<number, number>()
  for (const event of events) {
    const at = percentOf(event.date, view)
    let lane = 0
    while (lastAt[lane] !== undefined && at - (lastAt[lane] ?? 0) < LANE_GAP_PERCENT) {
      lane += 1
    }
    lastAt[lane] = at
    lanes.set(event.id, lane)
  }
  return lanes
}

export function upcomingOf(
  events: readonly ProjectEvent[],
  today: string,
  limit = Number.POSITIVE_INFINITY,
): readonly UpcomingEvent[] {
  return events
    .filter((event) => event.date >= today)
    .sort((one, other) => one.date.localeCompare(other.date) || one.id - other.id)
    .slice(0, limit)
    .map((event) => ({ event, daysLeft: daysBetween(today, event.date) }))
}

export function eventsToWrite(events: readonly ProjectEvent[], today: string): readonly ProjectEvent[] {
  return events.filter((event) => minutesToWrite(event, today))
}
