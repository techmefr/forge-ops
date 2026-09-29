import { z } from 'zod'
import type { ProjectEvent } from './EventContract.js'

export const WEATHERS = ['sunny', 'cloudy', 'stormy'] as const

export type Weather = (typeof WEATHERS)[number]

export const WEATHER_SOURCES = ['computed', 'manual'] as const

export type WeatherSource = (typeof WEATHER_SOURCES)[number]

export const RISK_LEVELS = ['high', 'medium', 'low'] as const

export type RiskLevel = (typeof RISK_LEVELS)[number]

export const CLOUDY_FROM_SCORE = 1
export const STORMY_FROM_SCORE = 4

export const RISK_TEXT_LIMIT = 300
export const DECISION_TEXT_LIMIT = 600
export const PERSON_LIMIT = 120
export const STATUS_SENTENCE_LIMIT = 200

export type WeatherScore = {
  late: number
  blocked: number
  highRisks: number
  total: number
}

export function computedWeather(score: WeatherScore): Weather {
  if (score.total >= STORMY_FROM_SCORE) {
    return 'stormy'
  }
  return score.total >= CLOUDY_FROM_SCORE ? 'cloudy' : 'sunny'
}

export type FollowUpAlerts = {
  late: number
  blocked: number
  highRisks: number
  minutesToWrite: number
}

export type ProjectRisk = {
  id: number
  projectId: number
  text: string
  level: RiskLevel
  owner: string | null
  epicId: number | null
  openedOn: string
  closedOn: string | null
}

export type ProjectDecision = {
  id: number
  projectId: number
  decidedOn: string
  text: string
  decidedBy: string
}

export type ProjectFollowUp = {
  projectId: number
  statusSentence: string | null
  weather: Weather
  source: WeatherSource
  score: WeatherScore
  alerts: FollowUpAlerts
  nextEvent: ProjectEvent | null
  risks: readonly ProjectRisk[]
  decisions: readonly ProjectDecision[]
  events: readonly ProjectEvent[]
}

const person = z.string().trim().min(1).max(PERSON_LIMIT)

export const riskDraftSchema = z
  .object({
    text: z.string().trim().min(1).max(RISK_TEXT_LIMIT),
    level: z.enum(RISK_LEVELS).default('medium'),
    owner: person.nullable().default(null),
    epicId: z.number().int().positive().nullable().default(null),
  })
  .strict()

export type RiskDraft = z.infer<typeof riskDraftSchema>

export const riskPatchSchema = z
  .object({
    text: z.string().trim().min(1).max(RISK_TEXT_LIMIT),
    level: z.enum(RISK_LEVELS),
    owner: person.nullable(),
    epicId: z.number().int().positive().nullable(),
    closed: z.boolean(),
  })
  .partial()
  .strict()

export type RiskPatch = z.infer<typeof riskPatchSchema>

export const decisionDraftSchema = z
  .object({
    text: z.string().trim().min(1).max(DECISION_TEXT_LIMIT),
    decidedBy: person.optional(),
    decidedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict()

export type DecisionDraft = z.infer<typeof decisionDraftSchema>

export const weatherChangeSchema = z
  .object({
    weather: z.enum(WEATHERS).nullable(),
    statusSentence: z.string().trim().max(STATUS_SENTENCE_LIMIT).nullable(),
  })
  .partial()
  .strict()
  .refine((change) => change.weather !== undefined || change.statusSentence !== undefined)

export type WeatherChange = z.infer<typeof weatherChangeSchema>
