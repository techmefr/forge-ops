import type { EpicState } from '../../../../contract/EpicContract.js'
import type { Milestone } from '../../../../contract/StoryContract.js'
import { daysLeft, nextMilestone } from '../Board/CardAttention.js'

export type StoryCensus = {
  total: number
  delivered: number
  started: number
  blocked: number
}

export function deriveEpicState(census: StoryCensus, deleted: boolean): EpicState {
  if (deleted) {
    return 'trash'
  }
  if (census.total === 0) {
    return 'todo'
  }
  if (census.delivered === census.total) {
    return 'done'
  }
  if (census.blocked > 0) {
    return 'blocked'
  }
  if (census.started > 0 || census.delivered > 0) {
    return 'doing'
  }
  return 'todo'
}

export function lateDaysOf(
  milestones: readonly Milestone[],
  state: EpicState,
  today: string,
): number | null {
  if (state === 'done' || state === 'trash') {
    return null
  }
  const left = daysLeft(nextMilestone(milestones, today), today)
  return left !== null && left < 0 ? -left : null
}

export function closesLoop(
  edges: ReadonlyMap<number, readonly number[]>,
  epicId: number,
  dependsOn: readonly number[],
): boolean {
  const seen = new Set<number>()
  const pending = [...dependsOn]
  while (pending.length > 0) {
    const current = pending.pop() ?? epicId
    if (current === epicId) {
      return true
    }
    if (seen.has(current)) {
      continue
    }
    seen.add(current)
    pending.push(...(edges.get(current) ?? []))
  }
  return false
}
