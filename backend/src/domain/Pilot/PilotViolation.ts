export class PilotViolationError extends Error {}

export class EmptyScriptError extends PilotViolationError {
  constructor() {
    super("an empty journey shows nothing, it needs at least one step")
    this.name = 'EmptyScriptError'
  }
}

export class ScriptTooLongError extends PilotViolationError {
  constructor(length: number, limit: number) {
    super(`${length} steps is too long to follow, the limit is ${limit}`)
    this.name = 'ScriptTooLongError'
  }
}

export class StepNeedsTargetError extends PilotViolationError {
  constructor(kind: string) {
    super(`a ${kind} step without a target does not know where to go`)
    this.name = 'StepNeedsTargetError'
  }
}

export class StepNeedsValueError extends PilotViolationError {
  constructor(kind: string) {
    super(`a ${kind} step without a value checks nothing`)
    this.name = 'StepNeedsValueError'
  }
}

export class UnsafeDestinationError extends PilotViolationError {
  constructor(target: string) {
    super(`${target} is not a public web address, the pilot will not open it`)
    this.name = 'UnsafeDestinationError'
  }
}

export class PilotRunNotFoundError extends PilotViolationError {
  constructor(reference: string) {
    super(`${reference} n a aucun parcours en cours`)
    this.name = 'PilotRunNotFoundError'
  }
}

export class PilotRunAlreadyLiveError extends PilotViolationError {
  constructor(reference: string) {
    super(`${reference} already has an open journey, finish it before starting another`)
    this.name = 'PilotRunAlreadyLiveError'
  }
}

export class PilotRunOverError extends PilotViolationError {
  constructor(reference: string, state: string) {
    super(`the journey of ${reference} is ${state}, it no longer moves`)
    this.name = 'PilotRunOverError'
  }
}

export class PilotRunPausedError extends PilotViolationError {
  constructor(reference: string) {
    super(`the journey of ${reference} is paused, resume it to move on`)
    this.name = 'PilotRunPausedError'
  }
}

export class PilotBrowserLostError extends PilotViolationError {
  constructor(reference: string) {
    super(`the browser of the journey of ${reference} no longer exists, restart it`)
    this.name = 'PilotBrowserLostError'
  }
}
