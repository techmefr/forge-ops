import type Database from 'better-sqlite3'
import {
  SYSTEM_AUTHOR,
  TRASH_RETENTION_DAYS,
  type EpicPatch,
  type EpicPlanning,
  type EpicStateChange,
} from '../../../../contract/EpicContract.js'
import { deriveEpicState } from './EpicPlan.js'
import { createEpicPlanWriter } from './EpicPlanWriter.js'
import { createEpicPlanningReader, type OverviewOptions } from './EpicPlanningReader.js'
import { EMPTY_CENSUS, prepareEpicReads, prepareEpicWrites, type EpicRow } from './EpicStatements.js'
import { EpicNotDeletedError } from './EpicViolation.js'
import { EpicNotFoundError } from '../Story/StoryViolation.js'
import { createProjectLinkCatalog, type ProjectLinkCatalog } from './ProjectLinkCatalog.js'
import { createTagCatalog, type TagCatalog } from './TagCatalog.js'

const DAY_MS = 86400000

const EPIC_CHILD_TABLES = ['epic_tag', 'epic_link', 'epic_state_history', 'epic_milestone']

export type { OverviewOptions }

export type EpicRepository = TagCatalog & ProjectLinkCatalog & {
  recordState: (epicId: number, by?: string) => void
  planningOf: (projectId: number, options?: OverviewOptions) => ReadonlyMap<number, EpicPlanning>
  planningOfEpic: (epicId: number, today?: string) => EpicPlanning
  plan: (epicId: number, patch: EpicPatch, by?: string) => void
  history: (epicId: number) => readonly EpicStateChange[]
  softDelete: (epicId: number, login: string) => void
  restore: (epicId: number, login: string) => void
  purgeExpired: () => number
}

export type EpicRepositoryOptions = {
  now?: () => string
}

export function createEpicRepository(
  db: Database.Database,
  { now = () => new Date().toISOString() }: EpicRepositoryOptions = {},
): EpicRepository {
  const reads = prepareEpicReads(db)
  const writes = prepareEpicWrites(db)

  function liveEpic(epicId: number): EpicRow {
    const row = reads.selectEpic.get(epicId)
    if (row === undefined || row.deleted_at !== null) {
      throw new EpicNotFoundError(epicId)
    }
    return row
  }

  function anyEpic(epicId: number): EpicRow {
    const row = reads.selectEpic.get(epicId)
    if (row === undefined) {
      throw new EpicNotFoundError(epicId)
    }
    return row
  }

  function recordState(epicId: number, by: string = SYSTEM_AUTHOR): void {
    const epic = reads.selectEpic.get(epicId)
    if (epic === undefined) {
      return
    }
    const census = reads.selectCensusOfEpic.get(epicId) ?? { epic_id: epicId, ...EMPTY_CENSUS }
    const state = deriveEpicState(census, epic.deleted_at !== null, epic.manual_state)
    if (reads.selectLastState.get(epicId)?.state === state) {
      return
    }
    writes.insertHistory.run(epicId, state, now(), by)
  }

  const { planningOf } = createEpicPlanningReader(reads, now)
  const { writePlan } = createEpicPlanWriter({ db, reads, writes, liveEpic, recordState })

  const purge = db.transaction((): number => {
    const cutoff = new Date(Date.parse(now()) - TRASH_RETENTION_DAYS * DAY_MS).toISOString()
    const expired = reads.selectExpired.all(cutoff)
    for (const { id } of expired) {
      for (const table of EPIC_CHILD_TABLES) {
        db.prepare(`DELETE FROM ${table} WHERE epic_id = ?`).run(id)
      }
      db.prepare('DELETE FROM epic_dependency WHERE epic_id = ? OR depends_on_epic_id = ?').run(id, id)
      db.prepare('DELETE FROM epic WHERE id = ?').run(id)
    }
    return expired.length
  })

  return {
    ...createTagCatalog(db),
    ...createProjectLinkCatalog(db),
    recordState,
    planningOf,

    planningOfEpic: (epicId, today) => {
      const epic = anyEpic(epicId)
      const found = planningOf(epic.project_id, { today, deleted: epic.deleted_at !== null }).get(epicId)
      if (found === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return found
    },

    plan: (epicId, patch, by = SYSTEM_AUTHOR) => writePlan(epicId, patch, by),

    history: (epicId) => {
      anyEpic(epicId)
      return reads.selectHistory.all(epicId).map(({ state, at, by }) => ({ state, at, by }))
    },

    softDelete: (epicId, login) => {
      liveEpic(epicId)
      writes.markDeleted.run(now(), epicId)
      recordState(epicId, login)
    },

    restore: (epicId, login) => {
      if (anyEpic(epicId).deleted_at === null) {
        throw new EpicNotDeletedError(epicId)
      }
      writes.markDeleted.run(null, epicId)
      recordState(epicId, login)
    },

    purgeExpired: () => purge(),
  }
}
