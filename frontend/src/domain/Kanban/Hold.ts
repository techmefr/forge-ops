import type { StoryHold } from '@/domain/Board/BoardModel'

export function holdOf(holds: readonly StoryHold[], storyId: number): StoryHold | null {
  return holds.find((held) => held.storyId === storyId) ?? null
}
