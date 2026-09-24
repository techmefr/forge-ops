export abstract class ForgeCardViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class EmptySelectionError extends ForgeCardViolationError {
  constructor() {
    super('Une forge a besoin d au moins une story', 'EmptySelectionError')
  }
}

export class DuplicateStoryIdError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`La story ${storyId} est selectionnee deux fois`, 'DuplicateStoryIdError')
  }
}

export class ForgeStoryNotFoundError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`Story ${storyId} introuvable`, 'ForgeStoryNotFoundError')
  }
}

export class StoryNotInBacklogError extends ForgeCardViolationError {
  constructor(reference: string, state: string) {
    super(`La story ${reference} est en ${state}, pas dans le backlog`, 'StoryNotInBacklogError')
  }
}

export class StoryAlreadyOnOpenCardError extends ForgeCardViolationError {
  constructor(reference: string, forgeCardReference: string) {
    super(`La story ${reference} est deja portee par la forge ${forgeCardReference}`, 'StoryAlreadyOnOpenCardError')
  }
}
