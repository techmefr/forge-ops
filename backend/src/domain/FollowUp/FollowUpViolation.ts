import { StoryViolationError } from '../Story/StoryViolation.js'

export class RiskNotFoundError extends StoryViolationError {
  constructor(riskId: number) {
    super(`Risque ${riskId} introuvable`, 'RiskNotFoundError')
  }
}

export class RiskEpicOutsideProjectError extends StoryViolationError {
  constructor(epicId: number, projectId: number) {
    super(`Epic ${epicId} does not belong to project ${projectId}`, 'RiskEpicOutsideProjectError')
  }
}
