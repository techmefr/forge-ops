export class DispatchViolationError extends Error {
  constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class PhaseNotReadyError extends DispatchViolationError {
  constructor(phase: string, missing: readonly string[]) {
    super(`Phase ${phase} is waiting for ${missing.join(', ')}`, 'PhaseNotReadyError')
  }
}

export class SessionAlreadyRunningError extends DispatchViolationError {
  constructor(reference: string, phase: string) {
    super(`A ${phase} session is already running on ${reference}`, 'SessionAlreadyRunningError')
  }
}

export class FleetSaturatedError extends DispatchViolationError {
  constructor(running: number, cap: number) {
    super(`${running} sessions are already running, the cap is ${cap}`, 'FleetSaturatedError')
  }
}

export class StoryTooThinError extends DispatchViolationError {
  readonly score: number
  readonly gapCodes: readonly string[]

  constructor(reference: string, score: number, gaps: readonly string[], gapCodes: readonly string[] = []) {
    super(
      `${reference} scores ${score} out of 100 on completeness: ${gaps.join('; ')}`,
      'StoryTooThinError',
    )
    this.score = score
    this.gapCodes = gapCodes
  }
}

export class DispatchTooFastError extends DispatchViolationError {
  constructor(burst: number, windowMs: number) {
    super(
      `The launch rate is capped at ${burst} sessions per ${Math.round(windowMs / 1000)} seconds`,
      'DispatchTooFastError',
    )
  }
}

export class StoryBlockedError extends DispatchViolationError {
  constructor(reference: string, blockers: readonly string[]) {
    super(`${reference} attend ${blockers.join(', ')}`, 'StoryBlockedError')
  }
}

export class LensOutsideReviewError extends DispatchViolationError {
  constructor(phase: string) {
    super(`a review lens is not read in phase ${phase}`, 'LensOutsideReviewError')
  }
}

export class HumanStepError extends DispatchViolationError {
  constructor(label: string) {
    super(`Step ${label} waits for a human validation, no agent starts`, 'HumanStepError')
  }
}

export class UnknownStepError extends DispatchViolationError {
  constructor(columnId: number) {
    super(`Step ${columnId} does not exist in the story's project`, 'UnknownStepError')
  }
}

export class CheckoutMissingError extends DispatchViolationError {
  constructor(project: string) {
    super(`Project ${project} has no working folder: declare it before launching a session`, 'CheckoutMissingError')
  }
}
