export const COST_PER_STORY_USD = 1.4

export const MEMORY_PER_SESSION_MB = 900

export type Estimate = {
  stories: number
  costUsd: number
  memoryMb: number
  remainingUsd: number
  affordable: boolean
}

export type EstimateInput = {
  stories: number
  capUsd: number
  spentUsd: number
}

export function estimateRun({ stories, capUsd, spentUsd }: EstimateInput): Estimate {
  const costUsd = Number((stories * COST_PER_STORY_USD).toFixed(2))
  const remainingUsd = Number(Math.max(capUsd - spentUsd, 0).toFixed(2))
  return {
    stories,
    costUsd,
    memoryMb: stories * MEMORY_PER_SESSION_MB,
    remainingUsd,
    affordable: costUsd <= remainingUsd,
  }
}

export type RoomInput = {
  capUsd: number
  spentUsd: number
  memoryFreeMb: number | null
}

export function roomForSessions({ capUsd, spentUsd, memoryFreeMb }: RoomInput): number {
  const remainingUsd = Math.max(capUsd - spentUsd, 0)
  const byBudget = Math.floor(remainingUsd / COST_PER_STORY_USD)
  if (memoryFreeMb === null) {
    return byBudget
  }
  return Math.max(Math.min(byBudget, Math.floor(memoryFreeMb / MEMORY_PER_SESSION_MB)), 0)
}
