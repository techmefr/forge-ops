export type CostCapConduct = 'stop' | 'downgrade' | 'reroute'

export type BudgetPolicy = {
  capUsd: number
  conduct: CostCapConduct
  downgradeModel: string
  rerouteBaseUrl: string | null
}

export type BudgetDecision = {
  conduct: 'proceed' | CostCapConduct
  spentUsd: number
  capUsd: number
  model?: string
  baseUrl?: string
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  capUsd: 20,
  conduct: 'stop',
  downgradeModel: 'claude-haiku-4-5-20251001',
  rerouteBaseUrl: null,
}

export const BUDGET_POLICY_KEY = 'budget.policy'
