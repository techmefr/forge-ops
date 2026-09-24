export type ForgeCardSelectionRefusal =
  | { reason: 'EmptySelection' }
  | { reason: 'DuplicateStoryId'; storyId: number }

export function refusalOfSelection(storyIds: readonly number[]): ForgeCardSelectionRefusal | null {
  if (storyIds.length === 0) {
    return { reason: 'EmptySelection' }
  }
  const seen = new Set<number>()
  for (const storyId of storyIds) {
    if (seen.has(storyId)) {
      return { reason: 'DuplicateStoryId', storyId }
    }
    seen.add(storyId)
  }
  return null
}
