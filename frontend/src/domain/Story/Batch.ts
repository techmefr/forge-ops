import type { Story } from '@/domain/Board/BoardModel'

export function storiesOfEpic(written: readonly Story[], epicId: number): readonly Story[] {
  return written.filter((story) => story.epicId === epicId)
}
