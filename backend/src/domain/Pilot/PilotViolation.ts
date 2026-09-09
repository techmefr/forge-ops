export class PilotViolationError extends Error {}

export class EmptyScriptError extends PilotViolationError {
  constructor() {
    super("un parcours vide ne montre rien, il faut au moins une etape")
    this.name = 'EmptyScriptError'
  }
}

export class ScriptTooLongError extends PilotViolationError {
  constructor(length: number, limit: number) {
    super(`${length} etapes est trop long a suivre, la limite est ${limit}`)
    this.name = 'ScriptTooLongError'
  }
}

export class StepNeedsTargetError extends PilotViolationError {
  constructor(kind: string) {
    super(`une etape ${kind} sans cible ne sait pas ou aller`)
    this.name = 'StepNeedsTargetError'
  }
}

export class StepNeedsValueError extends PilotViolationError {
  constructor(kind: string) {
    super(`une etape ${kind} sans valeur ne verifie rien`)
    this.name = 'StepNeedsValueError'
  }
}

export class UnsafeDestinationError extends PilotViolationError {
  constructor(target: string) {
    super(`${target} n est pas une adresse web, le pilote ne l ouvrira pas`)
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
    super(`${reference} a deja un parcours ouvert, il faut le finir avant d en lancer un autre`)
    this.name = 'PilotRunAlreadyLiveError'
  }
}

export class PilotRunOverError extends PilotViolationError {
  constructor(reference: string, state: string) {
    super(`le parcours de ${reference} est ${state}, il n avance plus`)
    this.name = 'PilotRunOverError'
  }
}

export class PilotRunPausedError extends PilotViolationError {
  constructor(reference: string) {
    super(`le parcours de ${reference} est en pause, il faut le reprendre pour avancer`)
    this.name = 'PilotRunPausedError'
  }
}

export class PilotBrowserLostError extends PilotViolationError {
  constructor(reference: string) {
    super(`le navigateur du parcours de ${reference} n existe plus, il faut le relancer`)
    this.name = 'PilotBrowserLostError'
  }
}
