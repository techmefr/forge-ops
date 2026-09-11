export { COMPLETENESS_FLOOR } from '../../../../contract/StoryContract.js'

import { COMPLETENESS_FLOOR } from '../../../../contract/StoryContract.js'

const TITLE_FLOOR = 20
const BODY_FLOOR = 120
const LINES_FLOOR = 3
const CRITERIA_FLOOR = 2

export type CompletenessInput = {
  title: string
  body: string
  criteria: readonly string[]
  hasTwin: boolean
}

export type { CompletenessVerdict } from '../../../../contract/StoryContract.js'

import type { CompletenessVerdict } from '../../../../contract/StoryContract.js'

type Rule = {
  weight: number
  gap: string
  hard?: true
  holds: (input: CompletenessInput) => boolean
}

const RULES: readonly Rule[] = [
  {
    weight: 15,
    gap: 'le titre est trop court pour dire ce que la story fait',
    holds: (input) => input.title.trim().length >= TITLE_FLOOR,
  },
  {
    weight: 25,
    gap: 'le corps ne dit pas assez pour etre code',
    hard: true,
    holds: (input) => input.body.trim().length >= BODY_FLOOR,
  },
  {
    weight: 15,
    gap: 'le corps ne dit ni le besoin ni le pourquoi',
    holds: (input) => input.body.split('\n').filter((line) => line.trim() !== '').length >= LINES_FLOOR,
  },
  {
    weight: 30,
    gap: `la story porte moins de ${CRITERIA_FLOOR} criteres d'acceptance`,
    hard: true,
    holds: (input) => input.criteria.length >= CRITERIA_FLOOR,
  },
  {
    weight: 15,
    gap: "la story n'a pas sa jumelle de test",
    holds: (input) => input.hasTwin,
  },
]

export function scoreCompleteness(input: CompletenessInput): CompletenessVerdict {
  const gaps: string[] = []
  let score = 0
  let hardFailure = false
  for (const rule of RULES) {
    if (rule.holds(input)) {
      score += rule.weight
      continue
    }
    gaps.push(rule.gap)
    hardFailure = hardFailure || rule.hard === true
  }
  const capped = hardFailure ? Math.min(score, COMPLETENESS_FLOOR - 1) : score
  return { score: capped, launchable: capped >= COMPLETENESS_FLOOR, gaps }
}
