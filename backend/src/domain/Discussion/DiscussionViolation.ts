export class EmptyRemarkError extends Error {
  constructor(reference: string) {
    super(`Une remarque vide n apporte rien a la discussion de ${reference}`)
    this.name = 'EmptyRemarkError'
  }
}

export class StoryAlreadyHeldError extends Error {
  constructor(reference: string) {
    super(`La story ${reference} est deja bloquee, il faut repondre dans le fil pour la liberer`)
    this.name = 'StoryAlreadyHeldError'
  }
}
