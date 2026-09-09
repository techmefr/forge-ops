export abstract class StoryViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class StoryNotFoundError extends StoryViolationError {
  constructor(storyId: number) {
    super(`Story ${storyId} introuvable`, 'StoryNotFoundError')
  }
}

export class TwinAlreadyWrittenError extends StoryViolationError {
  constructor(reference: string) {
    super(`La story ${reference} a deja sa story de test jumelle`, 'TwinAlreadyWrittenError')
  }
}

export class TwinOfTwinError extends StoryViolationError {
  constructor(reference: string) {
    super(`La story ${reference} est une story de test, elle ne peut pas avoir de jumelle`, 'TwinOfTwinError')
  }
}

export class TwinRequiredError extends StoryViolationError {
  constructor(reference: string) {
    super(`La story ${reference} ne peut pas quitter la redaction sans sa story de test jumelle`, 'TwinRequiredError')
  }
}

export class SelfDependencyError extends StoryViolationError {
  constructor(reference: string) {
    super(`La story ${reference} ne peut pas dependre d'elle-meme`, 'SelfDependencyError')
  }
}

export class BlockedByDependencyError extends StoryViolationError {
  constructor(reference: string, blockingReferences: readonly string[]) {
    super(`La story ${reference} est bloquee par ${blockingReferences.join(', ')}`, 'BlockedByDependencyError')
  }
}
