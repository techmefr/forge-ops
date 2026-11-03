import type Database from 'better-sqlite3'
import type { EpicPatch } from '../../../../contract/EpicContract.js'
import { closesLoop } from './EpicPlan.js'
import type { EpicReads, EpicWrites } from './EpicStatements.js'
import { EpicDependencyLoopError, EpicSelfDependencyError, EpicStateDerivedError, TagNotFoundError } from './EpicViolation.js'

const SCALAR_COLUMNS = {
  title: 'title',
  priority: 'priority',
  startedOn: 'started_on',
  statusNote: 'status_note',
  requestedBy: 'requested_by',
} as const

type PlanWriterInput = {
  db: Database.Database
  reads: EpicReads
  writes: EpicWrites
  liveEpic: (epicId: number) => unknown
  recordState: (epicId: number, by: string) => void
}

function assertDependencies(
  reads: EpicReads,
  liveEpic: (epicId: number) => unknown,
  epicId: number,
  dependsOn: readonly number[],
): void {
  for (const target of dependsOn) {
    if (target === epicId) {
      throw new EpicSelfDependencyError(epicId)
    }
    liveEpic(target)
  }
  const edges = new Map<number, number[]>()
  for (const row of reads.selectEveryDependency.all()) {
    if (row.epic_id !== epicId) {
      edges.set(row.epic_id, [...(edges.get(row.epic_id) ?? []), row.depends_on_epic_id])
    }
  }
  for (const target of dependsOn) {
    if (closesLoop(edges, epicId, [target])) {
      throw new EpicDependencyLoopError(epicId, target)
    }
  }
}

function writeScalars(db: Database.Database, epicId: number, patch: EpicPatch): void {
  const assignments: string[] = []
  const values: (string | null)[] = []
  for (const [key, column] of Object.entries(SCALAR_COLUMNS)) {
    const value = patch[key as keyof typeof SCALAR_COLUMNS]
    if (value !== undefined) {
      assignments.push(`${column} = ?`)
      values.push(value)
    }
  }
  if (assignments.length > 0) {
    db.prepare(`UPDATE epic SET ${assignments.join(', ')} WHERE id = ?`).run(...values, epicId)
  }
}

function writeRelations(
  writes: EpicWrites,
  epicId: number,
  patch: EpicPatch,
  tagIds: readonly number[],
  dependsOn: readonly number[],
): void {
  if (patch.tagIds !== undefined) {
    writes.deleteEpicTags.run(epicId)
    tagIds.forEach((tagId) => writes.insertEpicTag.run(epicId, tagId))
  }
  if (patch.links !== undefined) {
    writes.deleteEpicLinks.run(epicId)
    patch.links.forEach((link) => writes.insertEpicLink.run(epicId, link.kind, link.url))
  }
  if (patch.dependsOn !== undefined) {
    writes.deleteOwnDependencies.run(epicId)
    dependsOn.forEach((target) => writes.insertDependency.run(epicId, target))
  }
}

export function createEpicPlanWriter({ db, reads, writes, liveEpic, recordState }: PlanWriterInput) {
  const writePlan = db.transaction((epicId: number, patch: EpicPatch, by: string) => {
    liveEpic(epicId)
    if (patch.state !== undefined && (reads.selectCensusOfEpic.get(epicId)?.total ?? 0) > 0) {
      throw new EpicStateDerivedError(epicId)
    }
    const tagIds = [...new Set(patch.tagIds ?? [])]
    for (const tagId of tagIds) {
      if (reads.selectTag.get(tagId) === undefined) {
        throw new TagNotFoundError(tagId)
      }
    }
    const dependsOn = [...new Set(patch.dependsOn ?? [])]
    if (patch.dependsOn !== undefined) {
      assertDependencies(reads, liveEpic, epicId, dependsOn)
    }
    writeScalars(db, epicId, patch)
    if (patch.state !== undefined) {
      writes.updateManualState.run(patch.state, epicId)
      recordState(epicId, by)
    }
    writeRelations(writes, epicId, patch, tagIds, dependsOn)
  })

  return { writePlan }
}
