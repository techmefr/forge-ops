import type {
  StoryThread,
  ThreadChapter,
  ThreadEntry,
  ThreadOpening,
  ThreadVoice,
  ValidationRefusal,
} from '../../../../contract/ConversationContract.js'
import type { StoryRemark, TemplateColumn } from '../../../../contract/BoardContract.js'
import type { Story } from '../../../../contract/StoryContract.js'

export type {
  StoryThread,
  ThreadChapter,
  ThreadEntry,
  ThreadOpening,
  ThreadVoice,
  ValidationRefusal,
}

export type ThreadSession = {
  claudeSessionId: string
  phase: string
  agentName: string
  startedAt: string
}

export type ThreadProof = {
  name: string
  provenAt: string
  evidencePath: string
}

export type ThreadBody = {
  sessions: readonly ThreadSession[]
  remarks: readonly StoryRemark[]
  proofs: readonly ThreadProof[]
}

const WRITING_PHASE = 'spec'

export function openingOf(
  columns: readonly TemplateColumn[],
  story: Pick<Story, 'reference' | 'title' | 'body'>,
): ThreadOpening | null {
  const first = columns[0]
  if (first === undefined || first.prompt === null || first.prompt.trim() === '') {
    return null
  }
  const prompt = first.prompt
    .replaceAll('{reference}', story.reference)
    .replaceAll('{title}', story.title)
    .replaceAll('{body}', story.body)
  return { agent: first.agent, prompt }
}

export function voiceOf(agentSessionId: string | null): ThreadVoice {
  return agentSessionId === null || agentSessionId === '' ? 'human' : 'agent'
}

export function validationRefusalOf(state: string, voice: ThreadVoice): ValidationRefusal | null {
  if (voice === 'agent') {
    return 'AgentCannotValidate'
  }
  return state === 'drafting' ? null : 'StoryAlreadyValidated'
}

function testimonyOf(remark: StoryRemark): ThreadEntry {
  return {
    kind: 'testimony',
    at: remark.writtenAt,
    author: remark.author,
    voice: remark.voice,
    body: remark.body,
    evidencePath: null,
  }
}

function proofEntryOf(proof: ThreadProof): ThreadEntry {
  return {
    kind: 'proof',
    at: proof.provenAt,
    author: 'board',
    voice: 'agent',
    body: proof.name,
    evidencePath: proof.evidencePath,
  }
}

function chapterOf(chapters: readonly ThreadChapter[], at: string): number {
  let index = 0
  chapters.forEach((chapter, position) => {
    if (chapter.openedAt !== null && chapter.openedAt <= at) {
      index = position
    }
  })
  return index
}

export function chaptersOf({ sessions, remarks, proofs }: ThreadBody): readonly ThreadChapter[] {
  const ordered = [...sessions].sort((left, right) => left.startedAt.localeCompare(right.startedAt))
  const shells: ThreadChapter[] = [
    {
      phase: WRITING_PHASE,
      claudeSessionId: null,
      agentName: null,
      openedAt: null,
      collapsed: false,
      entries: [],
    },
    ...ordered.map((session) => ({
      phase: session.phase,
      claudeSessionId: session.claudeSessionId,
      agentName: session.agentName,
      openedAt: session.startedAt,
      collapsed: false,
      entries: [] as readonly ThreadEntry[],
    })),
  ]
  const filed: ThreadEntry[][] = shells.map(() => [])
  const entries = [...remarks.map(testimonyOf), ...proofs.map(proofEntryOf)].sort((left, right) =>
    left.at.localeCompare(right.at),
  )
  entries.forEach((entry) => {
    filed[chapterOf(shells, entry.at)]?.push(entry)
  })
  const kept = shells
    .map((shell, index) => ({ ...shell, entries: filed[index] ?? [] }))
    .filter((chapter, index) => index > 0 || chapter.entries.length > 0)
  const last = kept.length - 1
  return kept.map((chapter, index) => ({ ...chapter, collapsed: index < last }))
}

export function threadOf(
  story: Story,
  body: ThreadBody,
  opening: ThreadOpening | null,
): StoryThread {
  return {
    reference: story.reference,
    state: story.state,
    opening,
    awaitsValidation: story.state === 'drafting',
    chapters: chaptersOf(body),
  }
}
