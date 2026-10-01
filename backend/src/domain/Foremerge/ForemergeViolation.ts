export class ScopeViolationError extends Error {}

export class BlankScopeError extends ScopeViolationError {
  constructor() {
    super("an empty scope would reserve the whole repository, name a path")
    this.name = 'BlankScopeError'
  }
}

export class ScopeNotWrittenError extends ScopeViolationError {
  constructor(pathPrefix: string) {
    super(`the reservation of ${pathPrefix} was not recorded`)
    this.name = 'ScopeNotWrittenError'
  }
}

export class ScopeTakenError extends ScopeViolationError {
  readonly heldBy: string

  readonly heldSince: string

  constructor(pathPrefix: string, heldBy: string, heldSince: string, reason: string) {
    super(`${pathPrefix} is already reserved by ${heldBy} since ${heldSince}: ${reason}`)
    this.name = 'ScopeTakenError'
    this.heldBy = heldBy
    this.heldSince = heldSince
  }
}
