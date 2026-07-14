export type StarfleetStep =
  | 'SPEC'
  | 'PLAN'
  | 'TEST'
  | 'BUILD'
  | 'REVIEW'
  | 'CODE-SIMPLIFY'
  | 'SHIP'
  | 'mechanical'
  | 'creative'

export type RecommendedModel = 'opus' | 'sonnet' | 'haiku' | 'fable'

const STEP_TO_MODEL: Record<StarfleetStep, RecommendedModel> = {
  SPEC: 'opus',
  'CODE-SIMPLIFY': 'opus',
  PLAN: 'sonnet',
  BUILD: 'sonnet',
  TEST: 'sonnet',
  REVIEW: 'sonnet',
  SHIP: 'sonnet',
  mechanical: 'haiku',
  creative: 'fable',
}

const STEP_REASONS: Record<RecommendedModel, string> = {
  opus: 'architecture, decisions structurantes',
  sonnet: 'dev standard',
  haiku: 'faible complexite',
  fable: 'taches creatives',
}

export interface IModelRecommendation {
  step: StarfleetStep
  recommendedModel: RecommendedModel
  reason: string
}

export function recommendModel(step: StarfleetStep): IModelRecommendation {
  const recommendedModel = STEP_TO_MODEL[step]
  return {
    step,
    recommendedModel,
    reason: STEP_REASONS[recommendedModel],
  }
}
