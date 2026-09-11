export class UnreadableDenyListError extends Error {
  constructor(path: string, cause: string) {
    super(`Liste de deny illisible a ${path} : ${cause}`)
    this.name = 'UnreadableDenyListError'
  }
}

export class UnknownPhaseError extends Error {
  constructor(phase: string) {
    super(`Phase inconnue de la politique d outils : ${phase}`)
    this.name = 'UnknownPhaseError'
  }
}
