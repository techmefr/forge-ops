import { z } from 'zod'

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

export const stepVerdictSchema = z
  .object({
    status: z.enum(VERDICT_STATUSES),
    reason: z.string().max(4000).optional(),
  })
  .passthrough()

export type StepVerdict = z.infer<typeof stepVerdictSchema>
