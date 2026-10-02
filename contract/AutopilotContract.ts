import { z } from 'zod'
import { FINDING_SEVERITY_SEQUENCE } from './CheckpointContract.js'

export type AutopilotSettings = {
  enabled: boolean
  autoLaunch: boolean
  autoPublish: boolean
  autoMerge: boolean
}

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: true,
  autoLaunch: true,
  autoPublish: true,
  autoMerge: false,
}

export const autopilotSettingsSchema = z
  .object({
    enabled: z.boolean(),
    autoLaunch: z.boolean(),
    autoPublish: z.boolean(),
    autoMerge: z.boolean(),
  })
  .strict()

export type ProjectAutopilot = AutopilotSettings & { maySettle: boolean }

export const AUTO_CARD_STATES = ['running', 'paused', 'red'] as const

export type AutoCardState = (typeof AUTO_CARD_STATES)[number]

export type AutoCardView = {
  state: AutoCardState
  reason: string | null
}

export const DEFAULT_STEP_RETRIES = 2

export const MAX_STEP_RETRIES = 5

export const MAX_AUTO_TRANSITIONS = 40

export const VERDICT_STATUSES = ['pass', 'fail', 'blocked'] as const

export const MAX_VERDICT_FINDINGS = 50

export const lensVerdictSchema = z
  .object({
    status: z.enum(['pass', 'fail']),
    findings: z
      .array(
        z.object({
          severity: z.enum(FINDING_SEVERITY_SEQUENCE),
          path: z.string().min(1).max(300),
          statement: z.string().min(1).max(1000),
        }),
      )
      .max(MAX_VERDICT_FINDINGS)
      .optional(),
  })
  .passthrough()

export type LensVerdict = z.infer<typeof lensVerdictSchema>

export const criterionVerdictSchema = z
  .object({
    reference: z.string().min(1).max(100),
    status: z.enum(['met', 'unmet']),
    evidence: z.string().min(1).max(300).optional(),
  })
  .passthrough()

export type CriterionVerdict = z.infer<typeof criterionVerdictSchema>

export const stepVerdictSchema = z
  .object({
    status: z.enum(VERDICT_STATUSES),
    reason: z.string().max(4000).optional(),
    lenses: z
      .object({
        quality: lensVerdictSchema.optional(),
        security: lensVerdictSchema.optional(),
        accessibility: lensVerdictSchema.optional(),
      })
      .optional(),
    criteria: z.array(criterionVerdictSchema).max(200).optional(),
  })
  .passthrough()

export type StepVerdict = z.infer<typeof stepVerdictSchema>
