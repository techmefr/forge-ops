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
  readonly score: number
  readonly gapCodes: readonly string[]

  constructor(reference: string, score: number, gaps: readonly string[], gapCodes: readonly string[] = []) {
    super(
      `${reference} marque ${score} sur 100 en completude : ${gaps.join(' ; ')}`,
      'StoryTooThinError',
    )
    this.score = score
    this.gapCodes = gapCodes
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

export class HumanStepError extends DispatchViolationError {
  constructor(label: string) {
    super(`Le pas ${label} attend une validation humaine, aucun agent ne demarre`, 'HumanStepError')
  }
}

export class UnknownStepError extends DispatchViolationError {
  constructor(columnId: number) {
    super(`Le pas ${columnId} n'existe pas dans le projet de la story`, 'UnknownStepError')
  }
}

export class CheckoutMissingError extends DispatchViolationError {
  constructor(project: string) {
    super(`Le projet ${project} n'a pas de dossier de travail : declarez-le avant de lancer une session`, 'CheckoutMissingError')
  }
}
