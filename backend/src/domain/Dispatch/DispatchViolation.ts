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

export class StoryBlockedError extends DispatchViolationError {
  constructor(reference: string, blockers: readonly string[]) {
    super(`${reference} attend ${blockers.join(', ')}`, 'StoryBlockedError')
  }
}
