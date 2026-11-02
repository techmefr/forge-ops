import type Database from 'better-sqlite3'
import type { ManualEpicState } from '../../../../contract/EpicContract.js'
import type { EpicRepository } from '../Epic/EpicRepository.js'
import { InactiveAssigneeError } from '../Epic/EpicViolation.js'
import type { EpicCatalogStatements } from './EpicCatalogStatements.js'
import { EpicNotFoundError, EpicTakenError } from './StoryViolation.js'

export function createEpicAssignment(
  db: Database.Database,
  { selectEpicById, updateEpicAssignee, selectDisabledAt }: EpicCatalogStatements,
  epics: Pick<EpicRepository, 'plan'>,
) {
  function assertAssignable(login: string): void {
    if ((selectDisabledAt.get(login)?.disabled_at ?? null) !== null) {
      throw new InactiveAssigneeError(login)
    }
  }

  function assertHeldBy(epicId: number, login: string): void {
    const epic = selectEpicById.get(epicId)
    if (epic === undefined) {
      throw new EpicNotFoundError(epicId)
    }
    if (epic.assignee !== null && epic.assignee !== login) {
      throw new EpicTakenError(epicId, epic.assignee)
    }
  }

  return {
    assertAssignable,

    assignEpic: (epicId: number, login: string | null): void => {
      if (selectEpicById.get(epicId) === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      if (login !== null) {
        assertAssignable(login)
      }
      updateEpicAssignee.run(login, epicId)
    },

    claimEpic: db.transaction((epicId: number, login: string, state?: ManualEpicState): void => {
      assertHeldBy(epicId, login)
      assertAssignable(login)
      updateEpicAssignee.run(login, epicId)
      if (state !== undefined) {
        epics.plan(epicId, { state }, login)
      }
    }),

    releaseEpic: db.transaction((epicId: number, login: string, state?: ManualEpicState): void => {
      assertHeldBy(epicId, login)
      updateEpicAssignee.run(null, epicId)
      if (state !== undefined) {
        epics.plan(epicId, { state }, login)
      }
    }),

    assigneeOf: (epicId: number): string | null => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return epic.assignee
    },
  }
}
