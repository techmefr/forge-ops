export class UnreadableDenyListError extends Error {
  constructor(path: string, cause: string) {
    super(`Liste de deny illisible a ${path} : ${cause}`)
    this.name = 'UnreadableDenyListError'
  }
}
