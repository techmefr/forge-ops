import { z } from 'zod'
import { subjectLinksSchema, type SubjectLink } from './EpicContract.js'
import type { AccountRole } from './IdentityContract.js'

export const CAPACITY_MIN = 1

export const CAPACITY_MAX = 99

export type ProjectSheet = {
  id: number
  slug: string
  name: string
  colour: string
  position: number
  adminUserId: number | null
  adminLogin: string | null
  adminName: string | null
  links: readonly SubjectLink[]
  usage: number
}

export const projectUpdateSchema = z
  .object({
    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    position: z.number().int().min(0).max(9999),
    adminId: z.number().int().positive().nullable(),
    links: subjectLinksSchema,
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0)

export const projectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    colour: z.string().trim().min(1).max(40),
    repository: z.string().trim().max(300).default(''),
  })
  .strict()

export type ProjectCreate = z.infer<typeof projectCreateSchema>

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>

export type BoardUserSheet = {
  id: number
  login: string
  displayName: string
  role: AccountRole
  superAdmin: boolean
  active: boolean
  capacity: number | null
}

export const boardUserChangeSchema = z
  .object({
    superAdmin: z.boolean(),
    active: z.boolean(),
    capacity: z.number().int().min(CAPACITY_MIN).max(CAPACITY_MAX).nullable(),
  })
  .partial()
  .strict()
  .refine((change) => Object.keys(change).length > 0)

export type BoardUserChange = z.infer<typeof boardUserChangeSchema>

export const boardUserDraftSchema = z.object({
  login: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  displayName: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
  role: z.enum(['director', 'architect']),
})

export type BoardUserDraft = z.infer<typeof boardUserDraftSchema>
