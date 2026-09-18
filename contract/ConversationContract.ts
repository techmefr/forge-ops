export const THREAD_VOICES = ['human', 'agent'] as const

export type ThreadVoice = (typeof THREAD_VOICES)[number]

export const THREAD_ENTRY_KINDS = ['testimony', 'proof'] as const

export type ThreadEntryKind = (typeof THREAD_ENTRY_KINDS)[number]

export type ThreadEntry = {
  kind: ThreadEntryKind
  at: string
  author: string
  voice: ThreadVoice
  body: string
  evidencePath: string | null
}

export type ThreadChapter = {
  phase: string
  claudeSessionId: string | null
  agentName: string | null
  openedAt: string | null
  collapsed: boolean
  entries: readonly ThreadEntry[]
}

export type ThreadOpening = {
  agent: string | null
  prompt: string
}

export type StoryThread = {
  reference: string
  state: string
  opening: ThreadOpening | null
  awaitsValidation: boolean
  chapters: readonly ThreadChapter[]
}

export const VALIDATION_REFUSALS = ['AgentCannotValidate', 'StoryAlreadyValidated'] as const

export type ValidationRefusal = (typeof VALIDATION_REFUSALS)[number]
