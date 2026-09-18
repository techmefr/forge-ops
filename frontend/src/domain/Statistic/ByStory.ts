import type { SessionHistoryEntry } from '@/domain/Board/BoardModel'

export type StoryTally = {
  storyId: number
  storyReference: string
  sessions: number
  seconds: number
  costUsd: number
}

export function perStory(history: readonly SessionHistoryEntry[]): readonly StoryTally[] {
  const tallies = new Map<number, StoryTally>()
  for (const entry of history) {
    const held = tallies.get(entry.storyId) ?? {
      storyId: entry.storyId,
      storyReference: entry.storyReference,
      sessions: 0,
      seconds: 0,
      costUsd: 0,
    }
    tallies.set(entry.storyId, {
      ...held,
      sessions: held.sessions + 1,
      seconds: held.seconds + (entry.seconds ?? 0),
      costUsd: held.costUsd + (entry.costUsd ?? 0),
    })
  }
  return [...tallies.values()].sort((one, other) => other.seconds - one.seconds)
}
