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

export abstract class ItemInUseError extends StoryViolationError {
  readonly usage: number

  protected constructor(message: string, name: string, usage: number) {
    super(message, name)
    this.usage = usage
  }

  get reason(): string {
    return `used by ${this.usage} ${this.usage === 1 ? 'subject' : 'subjects'}`
  }
}

export class TagInUseError extends ItemInUseError {
  constructor(tagId: number, usage: number) {
    super(`Le tag ${tagId} est utilise par ${usage} epique(s)`, 'TagInUseError', usage)
  }
}

export class ProjectInUseError extends ItemInUseError {
  constructor(projectId: number, usage: number) {
    super(`Project ${projectId} is used by ${usage} epic(s)`, 'ProjectInUseError', usage)
  }
}

export class ProjectAdminRefusedError extends StoryViolationError {
  constructor(userId: number) {
    super(`Account ${userId} does not exist or is deactivated: it cannot administer a project`, 'ProjectAdminRefusedError')
  }
}

export class InactiveAssigneeError extends StoryViolationError {
  constructor(login: string) {
    super(`Account ${login} is deactivated: no subject can be assigned to it`, 'InactiveAssigneeError')
  }
}

export class EpicStateDerivedError extends StoryViolationError {
  constructor(epicId: number) {
    super(`L etat de l epique ${epicId} decoule de ses stories`, 'EpicStateDerivedError')
  }
}
