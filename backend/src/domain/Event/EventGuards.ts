import type { ProjectEvent } from '../../../../contract/EventContract.js'
import { EpicNotFoundError, ProjectNotFoundError } from '../Story/StoryViolation.js'
import { toEvent, type EventStatements } from './EventStatements.js'
import { EventEpicOutsideProjectError, EventNotFoundError } from './EventViolation.js'

export function createEventGuards({ selectProject, selectEpic, selectOne }: EventStatements) {
  function assertProject(projectId: number): void {
    if (selectProject.get(projectId) === undefined) {
      throw new ProjectNotFoundError(projectId)
    }
  }

  function assertEpicInProject(epicId: number, projectId: number): void {
    const epic = selectEpic.get(epicId)
    if (epic === undefined || epic.deleted_at !== null) {
      throw new EpicNotFoundError(epicId)
    }
    if (epic.project_id !== projectId) {
      throw new EventEpicOutsideProjectError(epicId, projectId)
    }
  }

  function find(eventId: number): ProjectEvent {
    const row = selectOne.get(eventId)
    if (row === undefined) {
      throw new EventNotFoundError(eventId)
    }
    return toEvent(row)
  }

  return { assertProject, assertEpicInProject, find }
}
