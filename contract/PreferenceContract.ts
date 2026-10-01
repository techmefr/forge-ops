import { z } from 'zod'

export const FORGE_VIEW_CHOICES = ['kanban', 'pipeline'] as const

export type ForgeViewChoice = (typeof FORGE_VIEW_CHOICES)[number]

export const preferencesChangeSchema = z.object({ forgeView: z.enum(FORGE_VIEW_CHOICES) })

export type BoardPreferences = {
  forgeView: ForgeViewChoice | null
}
