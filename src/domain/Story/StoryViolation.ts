export class StoryNotFoundError extends Error {
  constructor(storyId: number) {
    super(`Story ${storyId} introuvable`)
    this.name = 'StoryNotFoundError'
  }
}

export class TwinAlreadyWrittenError extends Error {
  constructor(reference: string) {
    super(`La story ${reference} a deja sa story de test jumelle`)
    this.name = 'TwinAlreadyWrittenError'
  }
}

export class TwinOfTwinError extends Error {
  constructor(reference: string) {
    super(`La story ${reference} est une story de test, elle ne peut pas avoir de jumelle`)
    this.name = 'TwinOfTwinError'
  }
}

export class TwinRequiredError extends Error {
  constructor(reference: string) {
    super(`La story ${reference} ne peut pas quitter la redaction sans sa story de test jumelle`)
    this.name = 'TwinRequiredError'
  }
}

export class SelfDependencyError extends Error {
  constructor(reference: string) {
    super(`La story ${reference} ne peut pas dependre d'elle-meme`)
    this.name = 'SelfDependencyError'
  }
}

export class BlockedByDependencyError extends Error {
  constructor(reference: string, blockingReferences: readonly string[]) {
    super(`La story ${reference} est bloquee par ${blockingReferences.join(', ')}`)
    this.name = 'BlockedByDependencyError'
  }
}
