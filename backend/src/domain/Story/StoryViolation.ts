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
    super(`Story ${reference} already has its twin test story`, 'TwinAlreadyWrittenError')
  }
}

export class TwinOfTwinError extends StoryViolationError {
  constructor(reference: string) {
    super(`Story ${reference} is a test story, it cannot have a twin`, 'TwinOfTwinError')
  }
}

export class TwinRequiredError extends StoryViolationError {
  constructor(reference: string) {
    super(`Story ${reference} cannot leave drafting without its twin test story`, 'TwinRequiredError')
  }
}

export class SelfDependencyError extends StoryViolationError {
  constructor(reference: string) {
    super(`Story ${reference} cannot depend on itself`, 'SelfDependencyError')
  }
}

export class BlockedByDependencyError extends StoryViolationError {
  constructor(reference: string, blockingReferences: readonly string[]) {
    super(`Story ${reference} is blocked by ${blockingReferences.join(', ')}`, 'BlockedByDependencyError')
  }
}

export class PointsOutOfRangeError extends StoryViolationError {
  constructor(points: number) {
    super(`An estimate is a whole number of points above zero, not ${points}`, 'PointsOutOfRangeError')
  }
}

export class RolloutOutOfRangeError extends StoryViolationError {
  constructor(percent: number) {
    super(`An exposure is between 0 and 100 percent, not ${percent}`, 'RolloutOutOfRangeError')
  }
}

export class DependencyCycleError extends StoryViolationError {
  constructor(reference: string, through: readonly string[]) {
    super(
      `This link closes a loop: ${reference} already blocks ${through.join(' then ')}`,
      'DependencyCycleError',
    )
  }
}

export class ProjectSlugTakenError extends StoryViolationError {
  constructor(slug: string) {
    super(`Project ${slug} already exists on this board`, 'ProjectSlugTakenError')
  }
}

export class ProjectNotFoundError extends StoryViolationError {
  constructor(projectId: number) {
    super(`Projet ${projectId} introuvable`, 'ProjectNotFoundError')
  }
}

export class EpicNotFoundError extends StoryViolationError {
  constructor(epicId: number) {
    super(`Epique ${epicId} introuvable`, 'EpicNotFoundError')
  }
}

export class EpicTakenError extends StoryViolationError {
  constructor(epicId: number, assignee: string) {
    super(`Epic ${epicId} is assigned to ${assignee}`, 'EpicTakenError')
  }
}

export class StepBackReasonRequiredError extends StoryViolationError {
  constructor(reference: string) {
    super(
      `Moving story ${reference} back requires a written reason, a board without reasons loses its audit value`,
      'StepBackReasonRequiredError',
    )
  }
}

export class StepBackFromDoneError extends StoryViolationError {
  constructor(reference: string) {
    super(
      `Story ${reference} is merged: a merge is undone by a revert story, not by moving the card back`,
      'StepBackFromDoneError',
    )
  }
}

export class StepBackNotBackwardError extends StoryViolationError {
  constructor(reference: string, from: string, to: string) {
    super(
      `Moving story ${reference} from ${from} to ${to} is not a step back`,
      'StepBackNotBackwardError',
    )
  }
}

export class StepBackOffPipelineError extends StoryViolationError {
  constructor(reference: string, state: string) {
    super(
      `Story ${reference} is in ${state}, outside the sequence: there is no step back to compute`,
      'StepBackOffPipelineError',
    )
  }
}

export class AgentStepBackRefusedError extends StoryViolationError {
  constructor(named: string, decision: string) {
    super(`${decision} is a human decision, ${named} does not take it`, 'AgentStepBackRefusedError')
  }
}

export class DoneNotEarnedError extends StoryViolationError {
  constructor(reference: string, missing: readonly string[]) {
    super(
      `Closing story ${reference} and removing its worktree requires proof of completion: ${missing.join('; ')}`,
      'DoneNotEarnedError',
    )
  }
}

export class StoryNotYoursError extends StoryViolationError {
  constructor(reference: string, assignee: string) {
    super(
      `The epic of story ${reference} belongs to ${assignee}, nobody else touches it`,
      'StoryNotYoursError',
    )
  }
}

export class EmptyCardError extends StoryViolationError {
  constructor(reference: string) {
    super(`Card ${reference} needs a title and a body`, 'EmptyCardError')
  }
}

export class EmptyBlockedReasonError extends StoryViolationError {
  constructor(reference: string) {
    super(`Blocking story ${reference} requires a written reason`, 'EmptyBlockedReasonError')
  }
}
