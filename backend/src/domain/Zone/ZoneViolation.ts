export abstract class ZoneViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class ZoneNotFoundError extends ZoneViolationError {
  constructor(pathPrefix: string) {
    super(`No zone carries the prefix ${pathPrefix}`, 'ZoneNotFoundError')
  }
}

export class ZonePrefixRequiredError extends ZoneViolationError {
  constructor() {
    super('A zone requires a non-empty path prefix', 'ZonePrefixRequiredError')
  }
}
