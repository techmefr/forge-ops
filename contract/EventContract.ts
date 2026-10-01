import { z } from 'zod'
import { MILESTONE_KINDS, type MilestoneKind } from './StoryContract.js'

export const EVENT_TYPES = MILESTONE_KINDS

export type EventType = MilestoneKind

export const EVENT_TITLE_LIMIT = 120
export const EVENT_NOTE_LIMIT = 600
export const EVENT_MINUTES_LIMIT = 20000

export type ProjectEvent = {
  id: number
  type: EventType
  date: string
  title: string
  projectId: number
  epicId: number | null
  note: string | null
  minutes: string | null
  minutesUpdatedAt: string | null
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    return false
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const calendarDate = z.string().refine(isCalendarDate, { message: 'InvalidCalendarDate' })

const optionalText = (limit: number) => z.string().trim().max(limit).nullable()

export const eventDraftSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    date: calendarDate,
    title: z.string().trim().max(EVENT_TITLE_LIMIT).default(''),
    projectId: z.number().int().positive(),
    epicId: z.number().int().positive().nullable().default(null),
    note: optionalText(EVENT_NOTE_LIMIT).default(null),
    minutes: optionalText(EVENT_MINUTES_LIMIT).default(null),
  })
  .strict()

export type EventDraft = z.infer<typeof eventDraftSchema>

export const eventPatchSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    date: calendarDate,
    title: z.string().trim().max(EVENT_TITLE_LIMIT),
    epicId: z.number().int().positive().nullable(),
    note: optionalText(EVENT_NOTE_LIMIT),
    minutes: optionalText(EVENT_MINUTES_LIMIT),
  })
  .partial()
  .strict()

export type EventPatch = z.infer<typeof eventPatchSchema>

export const eventWindowSchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
})

export function hasMinutes(event: Pick<ProjectEvent, 'minutes'>): boolean {
  return event.minutes !== null && event.minutes.trim() !== ''
}

export function minutesToWrite(event: Pick<ProjectEvent, 'date' | 'minutes'>, today: string): boolean {
  return event.date < today && !hasMinutes(event)
}
