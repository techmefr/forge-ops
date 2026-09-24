import { FORGE_CARD_PROVIDERS, type ForgeCardProvider } from '../../../../contract/ForgeCardContract.js'

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

export type ForgeCardProviderRefusal = { reason: 'UnknownProvider'; provider: string }

export function refusalOfProvider(provider: string): ForgeCardProviderRefusal | null {
  return (FORGE_CARD_PROVIDERS as readonly string[]).includes(provider)
    ? null
    : { reason: 'UnknownProvider', provider }
}

export function isForgeCardProvider(provider: string): provider is ForgeCardProvider {
  return refusalOfProvider(provider) === null
}
