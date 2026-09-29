import { StoryViolationError } from '../Story/StoryViolation.js'

export class EventNotFoundError extends StoryViolationError {
  constructor(eventId: number) {
    super(`Evenement ${eventId} introuvable`, 'EventNotFoundError')
  }
}

export class EventEpicOutsideProjectError extends StoryViolationError {
  constructor(epicId: number, projectId: number) {
    super(`L epique ${epicId} n appartient pas au projet ${projectId}`, 'EventEpicOutsideProjectError')
  }
}
