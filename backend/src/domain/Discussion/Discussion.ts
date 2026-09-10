export type RemarkVoice = 'human' | 'agent'

export type StoryRemark = {
  id: number
  storyId: number
  author: string
  voice: RemarkVoice
  body: string
  writtenAt: string
}

export type StoryHold = {
  id: number
  storyId: number
  reason: string
  askedBy: string
  raisedAt: string
}

export type RemarkDraft = {
  storyId: number
  author: string
  voice: RemarkVoice
  body: string
}

export type HoldDraft = {
  storyId: number
  reason: string
  askedBy: string
}
