import type { ForgeCardView } from '@contract/ForgeCardContract'

export type ForgeUsage = {
  used: boolean
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export function usageOf(card: ForgeCardView): ForgeUsage {
  const inputTokens = card.inputTokens ?? 0
  const outputTokens = card.outputTokens ?? 0
  return {
    used: card.costUsd > 0 || card.durationSeconds > 0 || inputTokens + outputTokens > 0,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}
