export abstract class CheckpointViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class EvidenceRequiredError extends CheckpointViolationError {
  constructor(name: string) {
    super(`Checkpoint ${name} requires an evidence path, done means proven`, 'EvidenceRequiredError')
  }
}

export class CheckpointAlreadyProvenError extends CheckpointViolationError {
  constructor(name: string) {
    super(`Checkpoint ${name} is already proven`, 'CheckpointAlreadyProvenError')
  }
}

export class CheckpointOutOfOrderError extends CheckpointViolationError {
  constructor(name: string, missing: readonly string[]) {
    super(`Checkpoint ${name} comes before ${missing.join(', ')}`, 'CheckpointOutOfOrderError')
  }
}

export class SelfReviewRefusedError extends CheckpointViolationError {
  constructor(claudeSessionId: string, phase: string) {
    super(
      `Session ${claudeSessionId} produced phase ${phase}: it does not review its own work`,
      'SelfReviewRefusedError',
    )
  }
}

export class TestsTamperedError extends CheckpointViolationError {
  constructor(findings: readonly string[]) {
    super(`The test suite changed since it was written: ${findings.join('; ')}`, 'TestsTamperedError')
  }
}

export class MutationSurvivedError extends CheckpointViolationError {
  constructor(survivors: readonly string[]) {
    super(
      `Mutations survive the tests, they prove nothing: ${survivors.join('; ')}`,
      'MutationSurvivedError',
    )
  }
}

export class RedNotAssertedError extends CheckpointViolationError {
  constructor(reason: string) {
    super(`The red of the tests is not an assertion: ${reason}`, 'RedNotAssertedError')
  }
}

export class UnresolvedFindingError extends CheckpointViolationError {
  constructor(count: number) {
    super(`${count} unresolved strong finding(s) prevent closing the review`, 'UnresolvedFindingError')
  }
}

export class LensOutOfOrderError extends CheckpointViolationError {
  constructor(lens: string, blocking: string) {
    super(`The ${lens} pass waits for ${blocking} to be green`, 'LensOutOfOrderError')
  }
}

export class ReviewIncompleteError extends CheckpointViolationError {
  constructor(pending: readonly string[]) {
    super(`The review cascade is not finished, ${pending.join(', ')} remain`, 'ReviewIncompleteError')
  }
}

export class LensAlreadyPassedError extends CheckpointViolationError {
  constructor(lens: string) {
    super(`The ${lens} pass is already green`, 'LensAlreadyPassedError')
  }
}

export class CriteriaRequiredError extends CheckpointViolationError {
  constructor(reference: string) {
    super(`Story ${reference} has no acceptance criterion to validate`, 'CriteriaRequiredError')
  }
}

export class CriteriaUnmetError extends CheckpointViolationError {
  constructor(unmet: readonly string[]) {
    super(`Unmet acceptance criteria: ${unmet.join(', ')}`, 'CriteriaUnmetError')
  }
}
