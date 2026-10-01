export class BudgetViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class BudgetPolicyRefusedError extends BudgetViolationError {
  constructor(reason: string) {
    super(`Budget cap setting refused: ${reason}`, 'BudgetPolicyRefusedError')
  }
}

export class BudgetExhaustedError extends BudgetViolationError {
  constructor(spentUsd: number, capUsd: number) {
    super(
      `The daily cap is reached: ${spentUsd.toFixed(2)} dollars spent out of ${capUsd.toFixed(2)} allowed`,
      'BudgetExhaustedError',
    )
  }
}
