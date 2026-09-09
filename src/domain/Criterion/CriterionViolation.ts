export class CriterionViolationError extends Error {}

export class CriterionNotFoundError extends Error {
  constructor(criterionId: number) {
    super(`aucun critere ${criterionId}`)
    this.name = 'CriterionNotFoundError'
  }
}

export class CriterionEvidenceRequiredError extends CriterionViolationError {
  constructor(reference: string) {
    super(`le critere ${reference} ne se satisfait pas sans preuve`)
    this.name = 'CriterionEvidenceRequiredError'
  }
}

export class CriterionAlreadySatisfiedError extends CriterionViolationError {
  constructor(reference: string) {
    super(`le critere ${reference} est deja satisfait`)
    this.name = 'CriterionAlreadySatisfiedError'
  }
}

export class CriterionOnTwinError extends CriterionViolationError {
  constructor(reference: string) {
    super(`les criteres se portent sur la story fonctionnelle, pas sur ${reference}`)
    this.name = 'CriterionOnTwinError'
  }
}
