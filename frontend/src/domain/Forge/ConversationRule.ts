import type { StoryThread, ThreadVoice } from '@contract/ConversationContract'
import type { StreamedEvent } from '@/technical/Api/BoardStream'

export type ToolOutcome = 'started' | 'ok' | 'failed'

export type ThreadItem =
  | { kind: 'marker'; id: string; phase: string; agent: string | null }
  | {
      kind: 'message'
      id: string
      voice: ThreadVoice
      author: string
      body: string
      at: string | null
      proof: boolean
      evidencePath: string | null
    }
  | { kind: 'tool'; id: string; name: string; outcome: ToolOutcome }
  | { kind: 'notice'; id: string; text: string }

export function itemsOfThread(thread: StoryThread): readonly ThreadItem[] {
  return thread.chapters.flatMap((chapter, chapterIndex): readonly ThreadItem[] => [
    { kind: 'marker', id: `marker-${chapterIndex}`, phase: chapter.phase, agent: chapter.agentName },
    ...chapter.entries.map(
      (entry, position): ThreadItem => ({
        kind: 'message',
        id: `entry-${chapterIndex}-${position}`,
        voice: entry.voice,
        author: entry.author,
        body: entry.body,
        at: entry.at,
        proof: entry.kind === 'proof',
        evidencePath: entry.evidencePath,
      }),
    ),
  ])
}

export function withoutPersisted(
  live: readonly ThreadItem[],
  history: readonly ThreadItem[],
): readonly ThreadItem[] {
  const saved = new Set(
    history.flatMap((item) => (item.kind === 'message' ? [`${item.voice}|${item.body.trim()}`] : [])),
  )
  return live.filter((item) => item.kind !== 'message' || !saved.has(`${item.voice}|${item.body.trim()}`))
}

export function concernsStory(eventReference: unknown, storyReference: string): boolean {
  if (typeof eventReference !== 'string') {
    return false
  }
  return eventReference.split(/[\s(),]+/).includes(storyReference)
}

type ToolPayload = { id: string; name: string; outcome: ToolOutcome }

function toolsIn(payload: Record<string, unknown>): readonly ToolPayload[] {
  const raw = payload.tools
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry): readonly ToolPayload[] => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }
    const candidate = entry as Record<string, unknown>
    const outcome = candidate.outcome
    if (typeof candidate.id !== 'string' || (outcome !== 'started' && outcome !== 'ok' && outcome !== 'failed')) {
      return []
    }
    return [{ id: candidate.id, name: typeof candidate.name === 'string' ? candidate.name : '', outcome }]
  })
}

function withTool(items: readonly ThreadItem[], tool: ToolPayload): readonly ThreadItem[] {
  const known = items.find((item) => item.kind === 'tool' && item.id === tool.id)
  if (known === undefined) {
    return [...items, { kind: 'tool', id: tool.id, name: tool.name, outcome: tool.outcome }]
  }
  return items.map((item) =>
    item.kind === 'tool' && item.id === tool.id
      ? { ...item, name: item.name === '' ? tool.name : item.name, outcome: tool.outcome }
      : item,
  )
}

function textIn(payload: Record<string, unknown>): string | null {
  return typeof payload.text === 'string' && payload.text.trim() !== '' ? payload.text : null
}

export function foldEvent(
  items: readonly ThreadItem[],
  event: StreamedEvent,
  storyReference: string,
): readonly ThreadItem[] {
  const payload = event.payload
  if (!concernsStory(payload.reference, storyReference)) {
    return items
  }
  const stamp = `${event.name}-${items.length}`
  if (event.name === 'session.assistant' || event.name === 'session.user') {
    let next = items
    const text = event.name === 'session.assistant' ? textIn(payload) : null
    if (text !== null) {
      next = [
        ...next,
        { kind: 'message', id: stamp, voice: 'agent', author: 'agent', body: text, at: null, proof: false, evidencePath: null },
      ]
    }
    return toolsIn(payload).reduce(withTool, next)
  }
  if (event.name === 'session.human') {
    const text = textIn(payload)
    return text === null
      ? items
      : [
          ...items,
          { kind: 'message', id: stamp, voice: 'human', author: 'you', body: text, at: null, proof: false, evidencePath: null },
        ]
  }
  if (event.name === 'session.failed') {
    const message = typeof payload.message === 'string' ? payload.message : ''
    return [...items, { kind: 'notice', id: stamp, text: message }]
  }
  return items
}

export type ReplyRoute = 'note' | 'talk'

export function replyRouteOf(stepKind: 'backlog' | 'step' | 'done', humanStep: boolean): ReplyRoute {
  return stepKind === 'backlog' || humanStep ? 'note' : 'talk'
}

export function submitsOn(key: string, shift: boolean, composing: boolean): boolean {
  return key === 'Enter' && !shift && !composing
}

export type ProofLine = { id: string; author: string; body: string; evidencePath: string | null }

export type ThreadMessage = { id: string; body: string; evidencePath: string | null }

export type ThreadBlock =
  | Exclude<ThreadItem, { kind: 'message' }>
  | { kind: 'group'; id: string; voice: ThreadVoice; author: string; messages: readonly ThreadMessage[] }

export type GroupedThread = { blocks: readonly ThreadBlock[]; proofs: readonly ProofLine[] }

export function groupThread(items: readonly ThreadItem[]): GroupedThread {
  const blocks: ThreadBlock[] = []
  const proofs: ProofLine[] = []
  for (const item of items) {
    if (item.kind !== 'message') {
      blocks.push(item)
      continue
    }
    if (item.proof) {
      proofs.push({ id: item.id, author: item.author, body: item.body, evidencePath: item.evidencePath })
      continue
    }
    const message = { id: item.id, body: item.body, evidencePath: item.evidencePath }
    const last = blocks[blocks.length - 1]
    if (last !== undefined && last.kind === 'group' && last.voice === item.voice && last.author === item.author) {
      blocks[blocks.length - 1] = { ...last, messages: [...last.messages, message] }
      continue
    }
    blocks.push({ kind: 'group', id: item.id, voice: item.voice, author: item.author, messages: [message] })
  }
  return { blocks, proofs }
}
