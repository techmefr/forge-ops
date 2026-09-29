import { z } from 'zod'

export const EPIC_PRIORITIES = ['max', 'high', 'normal', 'low'] as const

export type EpicPriority = (typeof EPIC_PRIORITIES)[number]

export const DEFAULT_EPIC_PRIORITY: EpicPriority = 'normal'

export const LINK_KINDS = ['repo', 'speckit', 'graphify', 'doc', 'mockup', 'other'] as const

export type LinkKind = (typeof LINK_KINDS)[number]

export const EPIC_STATES = ['todo', 'doing', 'blocked', 'done', 'trash'] as const

export type EpicState = (typeof EPIC_STATES)[number]

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
  blockedSince: string | null
  waitingOn: readonly EpicWaitingOn[]
  deletedAt: string | null
}

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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
    priority: z.enum(EPIC_PRIORITIES),
    startedOn: calendarDate.nullable(),
    statusNote: z.string().trim().max(600).nullable(),
    requestedBy: z.string().trim().min(1).max(120).nullable(),
    tagIds: z.array(z.number().int().positive()).max(50),
    links: subjectLinksSchema,
    dependsOn: z.array(z.number().int().positive()).max(50),
  })
  .partial()
  .strict()

export type EpicPatch = z.infer<typeof epicPatchSchema>

export const tagDraftSchema = z.object({
  label: z.string().trim().min(1).max(40),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export type TagDraft = z.infer<typeof tagDraftSchema>
