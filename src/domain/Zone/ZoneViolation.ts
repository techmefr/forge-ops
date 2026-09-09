export abstract class ZoneViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class ZoneNotFoundError extends ZoneViolationError {
  constructor(pathPrefix: string) {
    super(`Aucune zone ne porte le prefixe ${pathPrefix}`, 'ZoneNotFoundError')
  }
}

export class ZonePrefixRequiredError extends ZoneViolationError {
  constructor() {
    super('Une zone exige un prefixe de chemin non vide', 'ZonePrefixRequiredError')
  }
}
