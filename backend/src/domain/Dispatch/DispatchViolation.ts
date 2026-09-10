export class DispatchViolationError extends Error {
  constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class PhaseNotReadyError extends DispatchViolationError {
  constructor(phase: string, missing: readonly string[]) {
    super(`La phase ${phase} attend ${missing.join(', ')}`, 'PhaseNotReadyError')
  }
}

export class SessionAlreadyRunningError extends DispatchViolationError {
  constructor(reference: string, phase: string) {
    super(`Une session ${phase} tourne deja sur ${reference}`, 'SessionAlreadyRunningError')
  }
}

export class FleetSaturatedError extends DispatchViolationError {
  constructor(running: number, cap: number) {
    super(`${running} sessions tournent deja, le plafond est de ${cap}`, 'FleetSaturatedError')
  }
}

export class StoryTooThinError extends DispatchViolationError {
  constructor(reference: string, score: number, gaps: readonly string[]) {
    super(
      `${reference} marque ${score} sur 100 en completude : ${gaps.join(' ; ')}`,
      'StoryTooThinError',
    )
  }
}

export class DispatchTooFastError extends DispatchViolationError {
  constructor(burst: number, windowMs: number) {
    super(
      `Le debit de lancement est plafonne a ${burst} sessions par ${Math.round(windowMs / 1000)} secondes`,
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
    super(`une lentille de review ne se lit pas en phase ${phase}`, 'LensOutsideReviewError')
  }
}
