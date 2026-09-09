export class IncidentViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class OriginNotFoundError extends IncidentViolationError {
  constructor(slug: string) {
    super(`Source d'incident ${slug} inconnue`, 'OriginNotFoundError')
  }
}

export class OriginSlugTakenError extends IncidentViolationError {
  constructor(slug: string) {
    super(`La source ${slug} existe deja`, 'OriginSlugTakenError')
  }
}

export class IncidentNotFoundError extends IncidentViolationError {
  constructor(incidentId: number) {
    super(`Incident ${incidentId} introuvable`, 'IncidentNotFoundError')
  }
}

export class IncidentAlreadyRuledError extends IncidentViolationError {
  constructor(incidentId: number, state: string) {
    super(`L'incident ${incidentId} est deja ${state}`, 'IncidentAlreadyRuledError')
  }
}

export class RefusalReasonRequiredError extends IncidentViolationError {
  constructor() {
    super('Un refus dit pourquoi', 'RefusalReasonRequiredError')
  }
}
