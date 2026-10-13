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
  | { kind: 'tool'; id: string; name: string; outcome: ToolOutcome; input: string; output: string }
  | { kind: 'notice'; id: string; text: string }

export function itemsOfThread(thread: StoryThread): readonly ThreadItem[] {
  return thread.chapters.flatMap((chapter, chapterIndex): readonly ThreadItem[] => {
    const messages = chapter.entries.map(
      (entry, position): { at: string; item: ThreadItem } => ({
        at: entry.at,
        item: {
          kind: 'message',
          id: `entry-${chapterIndex}-${position}`,
          voice: entry.voice,
          author: entry.author,
          body: entry.body,
          at: entry.at,
          proof: entry.kind === 'proof',
          evidencePath: entry.evidencePath,
        },
      }),
    )
    const tools = (thread.toolLogs ?? [])
      .filter((log) => chapter.claudeSessionId !== null && log.claudeSessionId === chapter.claudeSessionId)
      .map(
        (log): { at: string; item: ThreadItem } => ({
          at: log.at,
          item: {
            kind: 'tool',
            id: log.id,
            name: log.name,
            outcome: log.failed ? 'failed' : 'ok',
            input: log.input,
            output: log.output,
          },
        }),
      )
    const merged = [...messages, ...tools].sort((left, right) => left.at.localeCompare(right.at))
    return [
      { kind: 'marker', id: `marker-${chapterIndex}`, phase: chapter.phase, agent: chapter.agentName },
      ...merged.map((entry) => entry.item),
    ]
  })
}

export function withoutPersisted(
  live: readonly ThreadItem[],
  history: readonly ThreadItem[],
): readonly ThreadItem[] {
  const saved = new Set(
    history.flatMap((item) => (item.kind === 'message' ? [`${item.voice}|${item.body.trim()}`] : [])),
  )
  const savedTools = new Set(history.flatMap((item) => (item.kind === 'tool' ? [item.id] : [])))
  return live.filter((item) => {
    if (item.kind === 'tool') {
      return !savedTools.has(item.id)
    }
    return item.kind !== 'message' || !saved.has(`${item.voice}|${item.body.trim()}`)
  })
}

export function concernsStory(eventReference: unknown, storyReference: string): boolean {
  if (typeof eventReference !== 'string') {
    return false
  }
  return eventReference.split(/[\s(),]+/).includes(storyReference)
}

type ToolPayload = { id: string; name: string; outcome: ToolOutcome; input: string; output: string }

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
    return [
      {
        id: candidate.id,
        name: typeof candidate.name === 'string' ? candidate.name : '',
        outcome,
        input: typeof candidate.input === 'string' ? candidate.input : '',
        output: typeof candidate.output === 'string' ? candidate.output : '',
      },
    ]
  })
}

function withTool(items: readonly ThreadItem[], tool: ToolPayload): readonly ThreadItem[] {
  const known = items.find((item) => item.kind === 'tool' && item.id === tool.id)
  if (known === undefined) {
    return [...items, { kind: 'tool', id: tool.id, name: tool.name, outcome: tool.outcome, input: tool.input, output: tool.output }]
  }
  return items.map((item) =>
    item.kind === 'tool' && item.id === tool.id
      ? {
          ...item,
          name: item.name === '' ? tool.name : item.name,
          outcome: tool.outcome,
          input: item.input === '' ? tool.input : item.input,
          output: tool.output === '' ? item.output : tool.output,
        }
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

const PHASE_ORDER: readonly string[] = ['spec', 'architecture', 'code', 'gate', 'review', 'ship']

const PHASE_OF_PROOF: Readonly<Record<string, string>> = {
  spec_done: 'spec',
  arch_done: 'architecture',
  tests_written: 'code',
  build_done: 'code',
  verified: 'gate',
  reviewed: 'review',
}

function itemsBetweenMarkers(items: readonly ThreadItem[], phase: string): readonly ThreadItem[] {
  let inside = false
  return items.filter((item) => {
    if (item.kind === 'marker') {
      inside = item.phase === phase
    }
    return inside
  })
}

function closingIndexOf(items: readonly ThreadItem[], phase: string): number {
  let last = -1
  items.forEach((item, index) => {
    if (item.kind === 'message' && item.proof && PHASE_OF_PROOF[item.body.trim()] === phase) {
      last = index
    }
  })
  const proof = items[last]
  if (proof === undefined || proof.kind !== 'message' || proof.at === null) {
    return last
  }
  let closing = last
  for (let next = items[closing + 1]; next?.kind === 'message' && !next.proof && next.at === proof.at; next = items[closing + 1]) {
    closing += 1
  }
  return closing
}

function itemsBetweenProofs(items: readonly ThreadItem[], phase: string, present: readonly string[]): readonly ThreadItem[] {
  const position = PHASE_ORDER.indexOf(phase)
  if (position === -1) {
    return []
  }
  const start = Math.max(-1, ...PHASE_ORDER.slice(0, position).filter((earlier) => present.includes(earlier)).map((earlier) => closingIndexOf(items, earlier))) + 1
  const end = closingIndexOf(items, phase)
  const ranAfter = PHASE_ORDER.slice(position + 1).some((later) => closingIndexOf(items, later) !== -1)
  if (end === -1 && ranAfter) {
    return []
  }
  return items.slice(start, end === -1 ? items.length : end + 1).filter((item) => item.kind !== 'marker')
}

export function itemsOfPhase(
  items: readonly ThreadItem[],
  phase: string,
  present: readonly string[] = PHASE_ORDER,
): readonly ThreadItem[] {
  const markers = items.filter((item) => item.kind === 'marker').length
  const proofs = items.some((item) => item.kind === 'message' && item.proof)
  return markers > 1 || !proofs ? itemsBetweenMarkers(items, phase) : itemsBetweenProofs(items, phase, present)
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

export type LogTone = 'phase' | 'agent' | 'human' | 'tool' | 'failed' | 'notice'

export type LogLine = { id: string; tone: LogTone; text: string; detail: string }

const TOOL_GLYPH: Readonly<Record<ToolOutcome, string>> = { started: '…', ok: '✓', failed: '✗' }

export function logLinesOf(items: readonly ThreadItem[], phaseLabel: (phase: string) => string): readonly LogLine[] {
  return items.map((item): LogLine => {
    if (item.kind === 'marker') {
      const parts = [phaseLabel(item.phase), item.agent].filter((part) => part !== null && part !== '')
      return { id: item.id, tone: 'phase', text: parts.join(' · '), detail: '' }
    }
    if (item.kind === 'message') {
      const stamp = item.at === null ? '' : `${item.at} `
      return { id: item.id, tone: item.voice === 'human' ? 'human' : 'agent', text: `${stamp}${item.author}: ${item.body}`, detail: '' }
    }
    if (item.kind === 'tool') {
      const name = item.name === '' ? '·' : item.name
      const detail = [item.input, item.output].filter((part) => part !== '').join('\n\n')
      return { id: item.id, tone: item.outcome === 'failed' ? 'failed' : 'tool', text: `${TOOL_GLYPH[item.outcome]} ${name}`, detail }
    }
    return { id: item.id, tone: 'notice', text: item.text, detail: '' }
  })
}

export function quoteOf(selected: string): string {
  return selected
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line.trimEnd()}`.trimEnd())
    .join('\n')
}

export function withQuote(draft: string, selected: string): string {
  const quote = quoteOf(selected)
  if (selected.trim() === '') {
    return draft
  }
  return draft.trim() === '' ? `${quote}\n\n` : `${draft.trimEnd()}\n\n${quote}\n\n`
}
