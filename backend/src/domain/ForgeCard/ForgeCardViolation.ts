export abstract class ForgeCardViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class EmptySelectionError extends ForgeCardViolationError {
  constructor() {
    super('A forge needs at least one story', 'EmptySelectionError')
  }
}

export class DuplicateStoryIdError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`Story ${storyId} is selected twice`, 'DuplicateStoryIdError')
  }
}

export class ForgeStoryNotFoundError extends ForgeCardViolationError {
  constructor(storyId: number) {
    super(`Story ${storyId} introuvable`, 'ForgeStoryNotFoundError')
  }
}

export class StoryNotInBacklogError extends ForgeCardViolationError {
  constructor(reference: string, state: string) {
    super(`Story ${reference} is in ${state}, not in the backlog`, 'StoryNotInBacklogError')
  }
}

export class StoryAlreadyOnOpenCardError extends ForgeCardViolationError {
  constructor(reference: string, forgeCardReference: string) {
    super(`Story ${reference} is already carried by forge ${forgeCardReference}`, 'StoryAlreadyOnOpenCardError')
  }
}

export class ForgeCardNotFoundError extends ForgeCardViolationError {
  constructor(forgeCardId: number) {
    super(`Forge ${forgeCardId} introuvable`, 'ForgeCardNotFoundError')
  }
}

export class UnknownForgeCardProviderError extends ForgeCardViolationError {
  constructor(provider: string) {
    super(`Provider ${provider} is not recognised`, 'UnknownForgeCardProviderError')
  }
}

export class UnknownStepKeyError extends ForgeCardViolationError {
  constructor(stepKey: string) {
    super(`The step ${stepKey} does not exist in this project`, 'UnknownStepKeyError')
  }
}

export class DoneIsEarnedError extends ForgeCardViolationError {
  constructor(reference: string) {
    super(`${reference} reaches Done through its definition of done, not by a drop`, 'DoneIsEarnedError')
  }
}

export class DoneIsFinalError extends ForgeCardViolationError {
  constructor(reference: string) {
    super(`${reference} is done and stays there`, 'DoneIsFinalError')
  }
}

export class NotAtLastStepError extends ForgeCardViolationError {
  constructor(reference: string) {
    super(`${reference} is not in the last step of its workflow: it cannot be closed yet`, 'NotAtLastStepError')
  }
}

export class StepBusyError extends ForgeCardViolationError {
  constructor(reference: string) {
    super(`${reference} has a session in progress: stop it first`, 'StepBusyError')
  }
}

export class LaunchNeedsAStepError extends ForgeCardViolationError {
  constructor(reference: string) {
    super(`${reference} is not in a step: move it into one first`, 'LaunchNeedsAStepError')
  }
}
