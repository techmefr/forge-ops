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

export class UnresolvedFindingError extends CheckpointViolationError {
  constructor(count: number) {
    super(`${count} finding(s) fort(s) non resolu(s) empechent de clore la review`, 'UnresolvedFindingError')
  }
}
