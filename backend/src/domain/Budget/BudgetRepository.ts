import type Database from 'better-sqlite3'
import { BUDGET_POLICY_KEY, DEFAULT_BUDGET_POLICY, type BudgetDecision, type BudgetPolicy } from './Budget.js'
import { BudgetPolicyRefusedError } from './BudgetViolation.js'

const CONDUCTS = ['stop', 'downgrade', 'reroute'] as const

export type BudgetRepository = {
  readPolicy: () => BudgetPolicy
  writePolicy: (policy: BudgetPolicy) => BudgetPolicy
  spentToday: () => number
  decideConduct: () => BudgetDecision
}

function assertPolicy(policy: BudgetPolicy): BudgetPolicy {
  if (!Number.isFinite(policy.capUsd) || policy.capUsd <= 0) {
    throw new BudgetPolicyRefusedError('un plafond vaut un montant strictement positif')
  }
  if (!CONDUCTS.includes(policy.conduct)) {
    throw new BudgetPolicyRefusedError(`conduite inconnue ${policy.conduct}`)
  }
  if (policy.conduct === 'downgrade' && policy.downgradeModel.trim() === '') {
    throw new BudgetPolicyRefusedError('une degradation nomme le modele moins cher sur lequel repartir')
  }
  if (policy.conduct === 'reroute') {
    if (policy.rerouteBaseUrl === null || policy.rerouteBaseUrl.trim() === '') {
      throw new BudgetPolicyRefusedError('un reroutage nomme le routeur vers lequel partir')
    }
    if (!policy.rerouteBaseUrl.startsWith('https://')) {
      throw new BudgetPolicyRefusedError('un routeur se joint en https, jamais en clair')
    }
  }
  return policy
}

export function createBudgetRepository(db: Database.Database): BudgetRepository {
  const selectSetting = db.prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?')
  const upsertSetting = db.prepare<[string, string]>(
    `INSERT INTO board_setting (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  )
  const sumSpentToday = db.prepare<[], { total: number | null }>(
    `SELECT SUM(cost_usd) AS total FROM agent_session
      WHERE cost_usd IS NOT NULL AND date(started_at) = date('now')`,
  )

  function readPolicy(): BudgetPolicy {
    const stored = selectSetting.get(BUDGET_POLICY_KEY)
    if (stored === undefined) {
      return DEFAULT_BUDGET_POLICY
    }
    try {
      return assertPolicy({ ...DEFAULT_BUDGET_POLICY, ...(JSON.parse(stored.value) as Partial<BudgetPolicy>) })
    } catch {
      return DEFAULT_BUDGET_POLICY
    }
  }

  function spentToday(): number {
    return sumSpentToday.get()?.total ?? 0
  }

  return {
    readPolicy,
    spentToday,

    writePolicy: (policy) => {
      const checked = assertPolicy(policy)
      upsertSetting.run(BUDGET_POLICY_KEY, JSON.stringify(checked))
      return checked
    },

    decideConduct: () => {
      const policy = readPolicy()
      const spentUsd = spentToday()
      if (spentUsd < policy.capUsd) {
        return { conduct: 'proceed', spentUsd, capUsd: policy.capUsd }
      }
      if (policy.conduct === 'downgrade') {
        return { conduct: 'downgrade', spentUsd, capUsd: policy.capUsd, model: policy.downgradeModel }
      }
      if (policy.conduct === 'reroute') {
        return {
          conduct: 'reroute',
          spentUsd,
          capUsd: policy.capUsd,
          baseUrl: policy.rerouteBaseUrl ?? undefined,
        }
      }
      return { conduct: 'stop', spentUsd, capUsd: policy.capUsd }
    },
  }
}
