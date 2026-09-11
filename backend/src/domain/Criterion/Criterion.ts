export type { Criterion } from '../../../../contract/StoryContract.js'

export type CriterionDraft = {
  storyId: number
  reference: string
  statement: string
  persona?: string | null
  expectsRefusal?: boolean
}
