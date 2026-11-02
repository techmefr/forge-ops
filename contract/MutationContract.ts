export const MUTATION_OPERATORS = [
  'boolean_literal',
  'strict_comparison',
  'dropped_negation',
  'void_return',
] as const

export type MutationOperator = (typeof MUTATION_OPERATORS)[number]

export type Mutation = {
  path: string
  operator: MutationOperator
  line: number
  source: string
}

export type MutationOutcome = {
  path: string
  operator: MutationOperator
  line: number
  killed: boolean
}

export const MUTATION_FILE_CAP = 5

export const MUTATION_PER_FILE_CAP = 4

export const MUTATION_RUN_CAP = 12

export const MUTATION_TEST_TIMEOUT_MS = 120_000
