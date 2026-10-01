import { StoryViolationError } from '../Story/StoryViolation.js'

export class EventNotFoundError extends StoryViolationError {
  constructor(eventId: number) {
    super(`Evenement ${eventId} introuvable`, 'EventNotFoundError')
  }
}

export class EventEpicOutsideProjectError extends StoryViolationError {
  constructor(epicId: number, projectId: number) {
    super(`Epic ${epicId} does not belong to project ${projectId}`, 'EventEpicOutsideProjectError')
  }
}
