import type { EpicOverview } from '@/domain/Board/BoardModel'

export const OWNERSHIPS = ['all', 'mine', 'free'] as const

export type Ownership = (typeof OWNERSHIPS)[number]

export type EpicSieve = {
  projectId: number | null
  ownership: Ownership
  self: string
}

function held(epic: EpicOverview, sieve: EpicSieve): boolean {
  if (sieve.ownership === 'mine') {
    return epic.assignee === sieve.self
  }
  if (sieve.ownership === 'free') {
    return epic.assignee === null
  }
  return true
}

export function keepEpics(
  epics: readonly EpicOverview[],
  sieve: EpicSieve,
): readonly EpicOverview[] {
  return epics.filter(
    (epic) =>
      (sieve.projectId === null || epic.projectId === sieve.projectId) && held(epic, sieve),
  )
}

export function oneProjectOnly(
  epics: readonly EpicOverview[],
  chosen: readonly number[],
): boolean {
  const projects = new Set(
    chosen
      .map((id) => epics.find((epic) => epic.id === id))
      .filter((epic): epic is EpicOverview => epic !== undefined)
      .map((epic) => epic.projectId),
  )
  return projects.size <= 1
}
