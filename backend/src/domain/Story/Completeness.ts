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
  code: string
  gap: string
  hard?: true
  holds: (input: CompletenessInput) => boolean
}

const RULES: readonly Rule[] = [
  {
    weight: 15,
    code: 'TitleTooShort',
    gap: 'the title is too short to say what the story does',
    holds: (input) => input.title.trim().length >= TITLE_FLOOR,
  },
  {
    weight: 25,
    code: 'BodyTooShort',
    gap: 'the body does not say enough to be coded',
    hard: true,
    holds: (input) => input.body.trim().length >= BODY_FLOOR,
  },
  {
    weight: 15,
    code: 'BodyWithoutNeed',
    gap: 'the body says neither the need nor the why',
    holds: (input) => input.body.split('\n').filter((line) => line.trim() !== '').length >= LINES_FLOOR,
  },
  {
    weight: 30,
    code: 'CriteriaMissing',
    gap: `the story carries fewer than ${CRITERIA_FLOOR} acceptance criteria`,
    hard: true,
    holds: (input) => input.criteria.length >= CRITERIA_FLOOR,
  },
  {
    weight: 15,
    code: 'TwinMissing',
    gap: 'the story has no test twin',
    holds: (input) => input.hasTwin,
  },
]

export function scoreCompleteness(input: CompletenessInput): CompletenessVerdict {
  const gaps: string[] = []
  const gapCodes: string[] = []
  let score = 0
  let hardFailure = false
  for (const rule of RULES) {
    if (rule.holds(input)) {
      score += rule.weight
      continue
    }
    gaps.push(rule.gap)
    gapCodes.push(rule.code)
    hardFailure = hardFailure || rule.hard === true
  }
  const capped = hardFailure ? Math.min(score, COMPLETENESS_FLOOR - 1) : score
  return { score: capped, launchable: capped >= COMPLETENESS_FLOOR, gaps, gapCodes }
}
