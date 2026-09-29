import { z } from 'zod'
import type { MilestoneKind } from './StoryContract.js'

export const EPIC_PRIORITIES = ['max', 'high', 'normal', 'low'] as const

export type EpicPriority = (typeof EPIC_PRIORITIES)[number]

export const DEFAULT_EPIC_PRIORITY: EpicPriority = 'normal'

export const LINK_KINDS = ['repo', 'speckit', 'graphify', 'doc', 'mockup', 'other'] as const

export type LinkKind = (typeof LINK_KINDS)[number]

export const EPIC_STATES = ['todo', 'doing', 'blocked', 'done', 'trash'] as const

export type EpicState = (typeof EPIC_STATES)[number]

export const MANUAL_EPIC_STATES = ['todo', 'doing', 'blocked', 'done'] as const

export type ManualEpicState = (typeof MANUAL_EPIC_STATES)[number]

export const SUBJECT_FILTERS = ['open', 'late', 'todo', 'doing', 'blocked', 'done', 'trash'] as const

export type SubjectFilter = (typeof SUBJECT_FILTERS)[number]

export const UNASSIGNED = 'none'

export const TRASH_RETENTION_DAYS = 90

export const SYSTEM_AUTHOR = 'system'

export type SubjectLink = {
  kind: LinkKind
  url: string
}

export type Tag = {
  id: number
  label: string
  colour: string
  usage: number
}

export type EpicStateChange = {
  state: EpicState
  at: string
  by: string
}

export type EpicProgress = {
  delivered: number
  total: number
}

export type EpicWaitingOn = {
  id: number
  title: string
}

export type EpicNextEvent = {
  type: MilestoneKind
  date: string
  title: string
}

export type EpicPlanning = {
  priority: EpicPriority
  startedOn: string | null
  statusNote: string | null
  requestedBy: string | null
  tags: readonly Tag[]
  links: readonly SubjectLink[]
  dependsOn: readonly number[]
  state: EpicState
  progress: EpicProgress
  lateDays: number | null
  dueOn: string | null
  nextEvent: EpicNextEvent | null
  blockedSince: string | null
  waitingOn: readonly EpicWaitingOn[]
  deletedAt: string | null
}

export function inSubjectFilter(
  subject: Pick<EpicPlanning, 'state' | 'lateDays'>,
  filter: SubjectFilter,
): boolean {
  switch (filter) {
    case 'open':
      return subject.state === 'todo' || subject.state === 'doing' || subject.state === 'blocked'
    case 'late':
      return subject.lateDays !== null
    default:
      return subject.state === filter
  }
}

const calendarDate =z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const subjectLinkSchema = z.object({
  kind: z.enum(LINK_KINDS),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value)),
})

export const subjectLinksSchema = z.array(subjectLinkSchema).max(50)

export const epicPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    priority: z.enum(EPIC_PRIORITIES),
    startedOn: calendarDate.nullable(),
    statusNote: z.string().trim().max(600).nullable(),
    requestedBy: z.string().trim().min(1).max(120).nullable(),
    tagIds: z.array(z.number().int().positive()).max(50),
    links: subjectLinksSchema,
    dependsOn: z.array(z.number().int().positive()).max(50),
    state: z.enum(MANUAL_EPIC_STATES),
  })
  .partial()
  .strict()

export type EpicPatch = z.infer<typeof epicPatchSchema>

export const epicCreateSchema = z
  .object({
    projectId: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    businessIntent: z.string().trim().max(2000).optional(),
    assignee: z.string().trim().min(1).max(120).nullable().optional(),
    priority: z.enum(EPIC_PRIORITIES).optional(),
    startedOn: calendarDate.nullable().optional(),
    statusNote: z.string().trim().max(600).nullable().optional(),
    requestedBy: z.string().trim().min(1).max(120).nullable().optional(),
    tagIds: z.array(z.number().int().positive()).max(50).optional(),
    links: subjectLinksSchema.optional(),
    dependsOn: z.array(z.number().int().positive()).max(50).optional(),
  })
  .strict()

export type EpicCreate = z.infer<typeof epicCreateSchema>

export const epicAssignmentSchema = z
  .object({ login: z.string().trim().min(1).max(120).nullable() })
  .strict()

const absentWhenBlank = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

export const epicQuerySchema = z
  .object({
    project: z.preprocess(absentWhenBlank, z.coerce.number().int().positive().optional()),
    assignee: z.preprocess(absentWhenBlank, z.string().trim().max(120).optional()),
    state: z.preprocess(absentWhenBlank, z.enum(SUBJECT_FILTERS).optional()),
    tag: z.preprocess(absentWhenBlank, z.coerce.number().int().positive().optional()),
    q: z.preprocess(absentWhenBlank, z.string().trim().max(200).optional()),
  })
  .strict()

export type EpicQuery = z.infer<typeof epicQuerySchema>

export const tagDraftSchema = z.object({
  label: z.string().trim().min(1).max(40),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export type TagDraft = z.infer<typeof tagDraftSchema>
