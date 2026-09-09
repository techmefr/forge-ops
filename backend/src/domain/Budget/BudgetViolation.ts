export class BudgetViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class BudgetPolicyRefusedError extends BudgetViolationError {
  constructor(reason: string) {
    super(`Reglage de plafond refuse : ${reason}`, 'BudgetPolicyRefusedError')
  }
}

export class BudgetExhaustedError extends BudgetViolationError {
  constructor(spentUsd: number, capUsd: number) {
    super(
      `Le plafond du jour est atteint : ${spentUsd.toFixed(2)} dollars depenses pour ${capUsd.toFixed(2)} autorises`,
      'BudgetExhaustedError',
    )
  }
}
