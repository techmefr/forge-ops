export type Criterion = {
  id: number
  storyId: number
  reference: string
  statement: string
  persona: string | null
  expectsRefusal: boolean
  evidencePath: string | null
  satisfied: boolean
}

export type CriterionDraft = {
  storyId: number
  reference: string
  statement: string
  persona?: string | null
  expectsRefusal?: boolean
}
