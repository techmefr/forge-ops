export class CriterionViolationError extends Error {}

export class CriterionNotFoundError extends Error {
  constructor(criterionId: number) {
    super(`no criterion ${criterionId}`)
    this.name = 'CriterionNotFoundError'
  }
}

export class CriterionEvidenceRequiredError extends CriterionViolationError {
  constructor(reference: string) {
    super(`criterion ${reference} cannot be satisfied without proof`)
    this.name = 'CriterionEvidenceRequiredError'
  }
}

export class CriterionAlreadySatisfiedError extends CriterionViolationError {
  constructor(reference: string) {
    super(`criterion ${reference} is already satisfied`)
    this.name = 'CriterionAlreadySatisfiedError'
  }
}

export class CriterionOnTwinError extends CriterionViolationError {
  constructor(reference: string) {
    super(`criteria apply to the functional story, not to ${reference}`)
    this.name = 'CriterionOnTwinError'
  }
}
