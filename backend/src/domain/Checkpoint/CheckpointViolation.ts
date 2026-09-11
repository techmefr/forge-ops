export abstract class CheckpointViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class EvidenceRequiredError extends CheckpointViolationError {
  constructor(name: string) {
    super(`Le checkpoint ${name} exige un chemin de preuve, fini veut dire prouve`, 'EvidenceRequiredError')
  }
}

export class CheckpointAlreadyProvenError extends CheckpointViolationError {
  constructor(name: string) {
    super(`Le checkpoint ${name} est deja prouve`, 'CheckpointAlreadyProvenError')
  }
}

export class CheckpointOutOfOrderError extends CheckpointViolationError {
  constructor(name: string, missing: readonly string[]) {
    super(`Le checkpoint ${name} arrive avant ${missing.join(', ')}`, 'CheckpointOutOfOrderError')
  }
}

export class SelfReviewRefusedError extends CheckpointViolationError {
  constructor(claudeSessionId: string, phase: string) {
    super(
      `La session ${claudeSessionId} a produit la phase ${phase} : elle ne relit pas son propre travail`,
      'SelfReviewRefusedError',
    )
  }
}

export class TestsTamperedError extends CheckpointViolationError {
  constructor(findings: readonly string[]) {
    super(`La suite de tests a bouge depuis son ecriture : ${findings.join(' ; ')}`, 'TestsTamperedError')
  }
}

export class MutationSurvivedError extends CheckpointViolationError {
  constructor(survivors: readonly string[]) {
    super(
      `Des mutations survivent aux tests, ils ne prouvent rien : ${survivors.join(' ; ')}`,
      'MutationSurvivedError',
    )
  }
}

export class RedNotAssertedError extends CheckpointViolationError {
  constructor(reason: string) {
    super(`Le rouge des tests n'est pas une assertion : ${reason}`, 'RedNotAssertedError')
  }
}

export class UnresolvedFindingError extends CheckpointViolationError {
  constructor(count: number) {
    super(`${count} finding(s) fort(s) non resolu(s) empechent de clore la review`, 'UnresolvedFindingError')
  }
}

export class LensOutOfOrderError extends CheckpointViolationError {
  constructor(lens: string, blocking: string) {
    super(`La passe ${lens} attend que ${blocking} soit au vert`, 'LensOutOfOrderError')
  }
}

export class ReviewIncompleteError extends CheckpointViolationError {
  constructor(pending: readonly string[]) {
    super(`La cascade de review n'est pas terminee, il reste ${pending.join(', ')}`, 'ReviewIncompleteError')
  }
}

export class LensAlreadyPassedError extends CheckpointViolationError {
  constructor(lens: string) {
    super(`La passe ${lens} est deja au vert`, 'LensAlreadyPassedError')
  }
}

export class CriteriaRequiredError extends CheckpointViolationError {
  constructor(reference: string) {
    super(`La story ${reference} n'a aucun critere d'acceptation a valider`, 'CriteriaRequiredError')
  }
}

export class CriteriaUnmetError extends CheckpointViolationError {
  constructor(unmet: readonly string[]) {
    super(`Criteres d'acceptation non satisfaits : ${unmet.join(', ')}`, 'CriteriaUnmetError')
  }
}
