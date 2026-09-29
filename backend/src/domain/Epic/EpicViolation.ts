import { StoryViolationError } from '../Story/StoryViolation.js'

export class EpicSelfDependencyError extends StoryViolationError {
  constructor(epicId: number) {
    super(`L epique ${epicId} ne peut pas dependre d elle-meme`, 'EpicSelfDependencyError')
  }
}

export class EpicDependencyLoopError extends StoryViolationError {
  constructor(epicId: number, dependsOnEpicId: number) {
    super(
      `Ce lien ferme une boucle : l epique ${dependsOnEpicId} attend deja l epique ${epicId}`,
      'EpicDependencyLoopError',
    )
  }
}

export class EpicNotDeletedError extends StoryViolationError {
  constructor(epicId: number) {
    super(`L epique ${epicId} n est pas dans la corbeille`, 'EpicNotDeletedError')
  }
}

export class TagNotFoundError extends StoryViolationError {
  constructor(tagId: number) {
    super(`Tag ${tagId} introuvable`, 'TagNotFoundError')
  }
}

export class TagLabelTakenError extends StoryViolationError {
  constructor(label: string) {
    super(`Le tag ${label} existe deja`, 'TagLabelTakenError')
  }
}

export class TagInUseError extends StoryViolationError {
  constructor(tagId: number, usage: number) {
    super(`Le tag ${tagId} est utilise par ${usage} epique(s)`, 'TagInUseError')
  }
}
