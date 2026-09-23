export const BEHAVIOURAL_KIND_SEQUENCE = ['ordinary', 'human_wait', 'review_gate', 'ship'] as const

export type BehaviouralKind = (typeof BEHAVIOURAL_KIND_SEQUENCE)[number]

export type WorkflowColumn = {
  id: number
  key: string
  label: string
  colour: string
  position: number
  agentName: string
  command: string
  preprompt: string
  behaviouralKind: BehaviouralKind
}

export type WorkflowColumnDraft = {
  key: string
  label: string
  colour: string
  agentName: string
  command: string
  preprompt: string
  behaviouralKind: BehaviouralKind
}
