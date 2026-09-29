import { BACKLOG_STEP_KEY, DONE_STEP_KEY, type ForgeCardView } from '@contract/ForgeCardContract'
import type { StoryThread, ThreadChapter, ThreadEntry } from '@contract/ConversationContract'
import {
  bodyNumber,
  bodyText,
  identifierAt,
  nextIdentifier,
  refusal,
  reply,
  route,
  type DemoContext,
  type DemoReply,
  type DemoRoute,
} from './DemoModel'
import { columnsOf } from './DemoWorkflow'

const WORK_MS = 2600
const REPLY_MS = 1100

const NOTES: Readonly<Record<string, string>> = {
  architecture: 'Plan drafted: three small steps, each testable, no file outside the declared zone.',
  building: 'Failing test written first, then the code. All targeted tests pass, ready for your review.',
  gating: 'Gate run: lint, types and tests are green.',
  reviewing: 'Review done: one weak finding noted, nothing blocking.',
  shipping: 'Rebased on main, gate green again, merge request opened as a draft.',
}

const FALLBACK_NOTE = 'Step finished, the result is ready for your validation.'

function cardOf(context: DemoContext): ForgeCardView | undefined {
  return context.state.cards.find((card) => card.id === identifierAt(context))
}

function storyCardOf(context: DemoContext): ForgeCardView | undefined {
  return context.state.cards.find((card) => card.storyId === identifierAt(context))
}

function threadOf(context: DemoContext, card: ForgeCardView): StoryThread {
  const held = context.state.threads.get(card.storyId)
  if (held !== undefined) {
    return held
  }
  const created: StoryThread = {
    reference: card.storyReference,
    state: card.stepKey,
    opening: null,
    awaitsValidation: false,
    chapters: [],
  }
  context.state.threads.set(card.storyId, created)
  return created
}

function chapterOf(context: DemoContext, card: ForgeCardView): ThreadChapter {
  const thread = threadOf(context, card)
  const last = thread.chapters[thread.chapters.length - 1]
  if (last !== undefined && last.phase === card.stepKey) {
    return last
  }
  const opened: ThreadChapter = {
    phase: card.stepKey,
    claudeSessionId: card.claudeSessionId,
    agentName: columnsOf(context.state, card.projectId).find((column) => column.key === card.stepKey)?.agentName || 'agent',
    openedAt: context.env.now().toISOString(),
    collapsed: false,
    entries: [],
  }
  ;(thread.chapters as ThreadChapter[]).push(opened)
  return opened
}

function write(context: DemoContext, card: ForgeCardView, entry: Omit<ThreadEntry, 'at' | 'evidencePath' | 'kind'>): void {
  ;(chapterOf(context, card).entries as ThreadEntry[]).push({
    kind: 'testimony',
    at: context.env.now().toISOString(),
    evidencePath: null,
    ...entry,
  })
}

function announce(context: DemoContext, card: ForgeCardView, name: string, extra: Record<string, unknown>): void {
  context.env.emit({ name, payload: { reference: card.storyReference, storyId: card.storyId, ...extra } })
}

function startRun(context: DemoContext, card: ForgeCardView): string {
  const { state, env } = context
  const generation = (state.generation.get(card.id) ?? 0) + 1
  state.generation.set(card.id, generation)
  const sessionId = `demo-${card.reference.toLowerCase()}-${generation}`
  card.status = 'running'
  card.claudeSessionId = sessionId
  chapterOf(context, card)
  announce(context, card, 'session.dispatched', { claudeSessionId: sessionId })
  env.later(REPLY_MS, () => {
    if (state.generation.get(card.id) !== generation) {
      return
    }
    announce(context, card, 'session.assistant', {
      text: 'Reading the subject and the zone before touching anything.',
      tools: [{ id: `${sessionId}-read`, name: 'Read', outcome: 'ok' }],
    })
  })
  env.later(WORK_MS, () => {
    if (state.generation.get(card.id) !== generation) {
      return
    }
    const failing = card.stepKey === 'gating' && !state.failedOnce.has(card.id)
    if (failing) {
      state.failedOnce.add(card.id)
      card.status = 'failed'
      write(context, card, { author: 'agent', voice: 'agent', body: 'The gate failed: one test is red. Launch again once fixed.' })
      announce(context, card, 'session.failed', { message: 'The gate failed on one test' })
    } else {
      card.status = 'to_validate'
      const note = NOTES[card.stepKey] ?? FALLBACK_NOTE
      write(context, card, { author: 'agent', voice: 'agent', body: note })
      announce(context, card, 'session.assistant', { text: note, tools: [] })
    }
    card.costUsd = Number((card.costUsd + 0.35).toFixed(2))
    card.durationSeconds += 180
    announce(context, card, 'session.result', { claudeSessionId: sessionId })
  })
  return sessionId
}

function statusAfterEntering(context: DemoContext, card: ForgeCardView): boolean {
  const column = columnsOf(context.state, card.projectId).find((held) => held.key === card.stepKey)
  if (card.stepKey === BACKLOG_STEP_KEY || column === undefined) {
    card.status = 'idle'
    return false
  }
  if (column.provider === 'human') {
    card.status = 'human_review'
    return false
  }
  if (column.autoStart) {
    startRun(context, card)
    return true
  }
  card.status = 'idle'
  return false
}

function moved(card: ForgeCardView, started: boolean, status = 200): DemoReply {
  return reply({ card, started, claudeSessionId: started ? card.claudeSessionId : null }, status)
}

function move(context: DemoContext): DemoReply {
  const card = cardOf(context)
  const stepKey = bodyText(context.body, 'stepKey')
  if (card === undefined || stepKey === null) {
    return refusal(card === undefined ? 404 : 422, 'InvalidMoveOrder', 'This move cannot be made')
  }
  const columns = columnsOf(context.state, card.projectId)
  if (card.stepKey === DONE_STEP_KEY) {
    return refusal(409, 'DoneIsFinal', 'A delivered card stays delivered')
  }
  if (card.status === 'running') {
    return refusal(409, 'StepBusy', 'An agent is working on this card, stop it first')
  }
  if (stepKey === DONE_STEP_KEY) {
    if (columns[columns.length - 1]?.key !== card.stepKey) {
      return refusal(409, 'DoneIsEarned', 'A card reaches done by going through every step')
    }
    card.stepKey = DONE_STEP_KEY
    card.status = 'done'
    return moved(card, false)
  }
  if (stepKey !== BACKLOG_STEP_KEY && !columns.some((column) => column.key === stepKey)) {
    return refusal(404, 'UnknownStepKey', 'This step does not exist')
  }
  card.stepKey = stepKey
  return moved(card, statusAfterEntering(context, card))
}

function launch(context: DemoContext): DemoReply {
  const card = cardOf(context)
  if (card === undefined) {
    return refusal(404, 'ForgeCardNotFound', 'This card does not exist')
  }
  const column = columnsOf(context.state, card.projectId).find((held) => held.key === card.stepKey)
  if (column === undefined || column.provider === 'human') {
    return refusal(409, 'LaunchNeedsAStep', 'Put the card in an agent step first')
  }
  if (card.status === 'running') {
    return refusal(409, 'StepBusy', 'An agent is already working on this card')
  }
  startRun(context, card)
  return moved(card, true, 201)
}

function addBacklogCard(context: DemoContext): DemoReply {
  const subjectId = bodyNumber(context.body, 'subjectId')
  const title = bodyText(context.body, 'title')?.trim() ?? ''
  const subject = context.state.epics.find((epic) => epic.id === subjectId)
  if (subject === undefined || title === '') {
    return refusal(422, 'InvalidBacklogStory', 'A story needs a subject and a title')
  }
  const identifier = nextIdentifier(context.state)
  const number = context.state.cards.length + 1
  const card: ForgeCardView = {
    id: identifier,
    reference: `FORGE-${number + 100}`,
    storyId: identifier,
    storyReference: `FORGE-${number + 100}`,
    title,
    projectId: subject.projectId,
    subjectId: subject.id,
    subjectTitle: subject.title,
    stepKey: BACKLOG_STEP_KEY,
    provider: 'claude',
    status: 'idle',
    claudeSessionId: null,
    durationSeconds: 0,
    costUsd: 0,
  }
  context.state.cards.push(card)
  return reply(card, 201)
}

function talk(context: DemoContext): DemoReply {
  const card = storyCardOf(context)
  const message = bodyText(context.body, 'message')?.trim() ?? ''
  if (card === undefined || message === '') {
    return refusal(422, 'InvalidTalk', 'Say something to the agent')
  }
  write(context, card, { author: 'you', voice: 'human', body: message })
  announce(context, card, 'session.human', { text: message })
  context.env.later(REPLY_MS, () => {
    const answer = 'Understood, I take that into account and continue on the current step.'
    write(context, card, { author: 'agent', voice: 'agent', body: answer })
    announce(context, card, 'session.assistant', { text: answer, tools: [] })
    announce(context, card, 'session.result', {})
  })
  return reply({ ok: true }, 201)
}

function stop(context: DemoContext): DemoReply {
  const card = storyCardOf(context)
  if (card === undefined) {
    return refusal(404, 'ForgeCardNotFound', 'This card does not exist')
  }
  context.state.generation.set(card.id, (context.state.generation.get(card.id) ?? 0) + 1)
  card.status = 'failed'
  announce(context, card, 'session.failed', { message: 'The session was stopped' })
  return reply(null, 204)
}

function note(context: DemoContext): DemoReply {
  const card = storyCardOf(context)
  const body = bodyText(context.body, 'body')?.trim() ?? ''
  if (card === undefined || body === '') {
    return refusal(422, 'InvalidRemark', 'Write a message first')
  }
  write(context, card, { author: context.state.self.login, voice: 'human', body })
  context.env.later(REPLY_MS, () => {
    write(context, card, { author: 'agent', voice: 'agent', body: 'Noted. I will fold it into the next pass.' })
    announce(context, card, 'session.result', {})
  })
  return reply({ ok: true }, 201)
}

export const FORGE_ROUTES: readonly DemoRoute[] = [
  route('GET', '/api/forge-cards', (context) => {
    const project = Number(context.query.get('project') ?? 0)
    return reply(context.state.cards.filter((card) => card.projectId === project))
  }),
  route('GET', '/api/stories/(\\d+)/thread', (context) => {
    const card = storyCardOf(context)
    const held = context.state.threads.get(identifierAt(context))
    if (held !== undefined) {
      return reply(held)
    }
    return card === undefined ? refusal(404, 'StoryNotFound', 'This story does not exist') : reply(threadOf(context, card))
  }),
  route('POST', '/api/forge-cards/backlog', addBacklogCard),
  route('POST', '/api/forge-cards/(\\d+)/move', move),
  route('POST', '/api/forge-cards/(\\d+)/launch', launch),
  route('POST', '/api/stories/(\\d+)/talk', talk),
  route('DELETE', '/api/stories/(\\d+)/talk', stop),
  route('POST', '/api/stories/(\\d+)/discussion', note),
  route('POST', '/api/stories/(\\d+)/validate', () => reply({ ok: true })),
]
