export class ScopeViolationError extends Error {}

export class BlankScopeError extends ScopeViolationError {
  constructor() {
    super("un perimetre vide reserverait tout le depot, il faut nommer un chemin")
    this.name = 'BlankScopeError'
  }
}

export class ScopeNotWrittenError extends ScopeViolationError {
  constructor(pathPrefix: string) {
    super(`la reservation de ${pathPrefix} n a pas ete enregistree`)
    this.name = 'ScopeNotWrittenError'
  }
}

export class ScopeTakenError extends ScopeViolationError {
  readonly heldBy: string

  constructor(pathPrefix: string, heldBy: string, reason: string) {
    super(`${pathPrefix} est deja reserve par ${heldBy} : ${reason}`)
    this.name = 'ScopeTakenError'
    this.heldBy = heldBy
  }
}
