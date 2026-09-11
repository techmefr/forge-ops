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

export class PointsOutOfRangeError extends StoryViolationError {
  constructor(points: number) {
    super(`Une estimation vaut un nombre entier de points superieur a zero, pas ${points}`, 'PointsOutOfRangeError')
  }
}

export class RolloutOutOfRangeError extends StoryViolationError {
  constructor(percent: number) {
    super(`Une exposition vaut de 0 a 100 pour cent, pas ${percent}`, 'RolloutOutOfRangeError')
  }
}

export class DependencyCycleError extends StoryViolationError {
  constructor(reference: string, through: readonly string[]) {
    super(
      `Ce lien ferme une boucle : ${reference} bloque deja ${through.join(' puis ')}`,
      'DependencyCycleError',
    )
  }
}

export class ProjectSlugTakenError extends StoryViolationError {
  constructor(slug: string) {
    super(`Le projet ${slug} existe deja sur ce board`, 'ProjectSlugTakenError')
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
    super(`L epique ${epicId} est attribuee a ${assignee}`, 'EpicTakenError')
  }
}

export class StepBackReasonRequiredError extends StoryViolationError {
  constructor(reference: string) {
    super(
      `Reculer la story ${reference} exige une raison ecrite, un board sans raison perd sa valeur d audit`,
      'StepBackReasonRequiredError',
    )
  }
}

export class StepBackFromDoneError extends StoryViolationError {
  constructor(reference: string) {
    super(
      `La story ${reference} est fusionnee : on annule un merge par une story de revert, pas en reculant la carte`,
      'StepBackFromDoneError',
    )
  }
}

export class StepBackNotBackwardError extends StoryViolationError {
  constructor(reference: string, from: string, to: string) {
    super(
      `Reculer la story ${reference} de ${from} vers ${to} n est pas un retour en arriere`,
      'StepBackNotBackwardError',
    )
  }
}

export class StepBackOffPipelineError extends StoryViolationError {
  constructor(reference: string, state: string) {
    super(
      `La story ${reference} est en ${state}, hors de la sequence : aucun retour en arriere a calculer`,
      'StepBackOffPipelineError',
    )
  }
}

export class AgentStepBackRefusedError extends StoryViolationError {
  constructor(named: string, decision: string) {
    super(`${decision} est une decision humaine, ${named} ne la prend pas`, 'AgentStepBackRefusedError')
  }
}

export class DoneNotEarnedError extends StoryViolationError {
  constructor(reference: string, missing: readonly string[]) {
    super(
      `Clore la story ${reference} et effacer son worktree exige une preuve de fin : ${missing.join(' ; ')}`,
      'DoneNotEarnedError',
    )
  }
}

export class StoryNotYoursError extends StoryViolationError {
  constructor(reference: string, assignee: string) {
    super(
      `L epique de la story ${reference} appartient a ${assignee}, personne d autre ne la clot`,
      'StoryNotYoursError',
    )
  }
}

export class EmptyCardError extends StoryViolationError {
  constructor(reference: string) {
    super(`La carte ${reference} a besoin d un titre et d un corps`, 'EmptyCardError')
  }
}
