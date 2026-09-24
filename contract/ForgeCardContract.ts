export type ForgeCard = {
  id: number
  reference: string
  storyIds: readonly number[]
  createdAt: string
  closedAt: string | null
}

export type ForgeCardDraft = {
  storyIds: readonly number[]
}
