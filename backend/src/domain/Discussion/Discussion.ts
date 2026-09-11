export type {
  Discussion,
  RemarkVoice,
  StoryHold,
  StoryRemark,
} from '../../../../contract/BoardContract.js'

import type { RemarkVoice } from '../../../../contract/BoardContract.js'

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
