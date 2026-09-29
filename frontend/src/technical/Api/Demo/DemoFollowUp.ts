import { EVENT_TYPES, type EventType, type ProjectEvent } from '@contract/EventContract'
import {
  RISK_LEVELS,
  WEATHERS,
  computedWeather,
  type ProjectFollowUp,
  type ProjectRisk,
  type RiskLevel,
  type Weather,
} from '@contract/FollowUpContract'
import {
  bodyNumber,
  bodyText,
  dayOf,
  identifierAt,
  nextIdentifier,
  refusal,
  reply,
  route,
  type DemoContext,
  type DemoReply,
  type DemoRoute,
  type DemoState,
} from './DemoModel'
import { liveEpics } from './DemoSubjects'

function byDate(one: ProjectEvent, other: ProjectEvent): number {
  return one.date.localeCompare(other.date) || one.id - other.id
}

export function eventsOf(state: DemoState, projectId: number): ProjectEvent[] {
  return state.events.filter((event) => event.projectId === projectId).sort(byDate)
}

export function followUpOf(state: DemoState, projectId: number, today: string): ProjectFollowUp {
  const epics = liveEpics(state, projectId)
  const risks = state.risks.filter((risk) => risk.projectId === projectId)
  const events = eventsOf(state, projectId)
  const note = state.notes.get(projectId)
  const late = epics.filter((epic) => epic.state !== 'done' && epic.lateDays !== null).length
  const blocked = epics.filter((epic) => epic.state === 'blocked').length
  const highRisks = risks.filter((risk) => risk.closedOn === null && risk.level === 'high').length
  const score = { late, blocked, highRisks, total: late + blocked + highRisks }
  const manual = note?.manual ?? null
  return {
    projectId,
    statusSentence: note?.statusSentence ?? null,
    weather: manual ?? computedWeather(score),
    source: manual === null ? 'computed' : 'manual',
    score,
    alerts: {
      late,
      blocked,
      highRisks,
      minutesToWrite: events.filter((event) => event.date < today && event.minutes === null).length,
    },
    nextEvent: events.find((event) => event.date >= today) ?? null,
    risks: [...risks].sort((one, other) => other.id - one.id),
    decisions: state.decisions.filter((decision) => decision.projectId === projectId),
    events,
  }
}

function ensureNote(state: DemoState, projectId: number): { statusSentence: string | null; manual: Weather | null } {
  const held = state.notes.get(projectId) ?? { statusSentence: null, manual: null }
  state.notes.set(projectId, held)
  return held
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

function writeEvent(context: DemoContext, event: ProjectEvent): DemoReply | null {
  const { body, env } = context
  const type = bodyText(body, 'type')
  const date = bodyText(body, 'date')
  if ('type' in body) {
    if (type === null || !(EVENT_TYPES as readonly string[]).includes(type)) {
      return refusal(422, 'InvalidEvent', 'Unknown event type')
    }
    event.type = type as EventType
  }
  if ('date' in body) {
    if (date === null || !CALENDAR_DAY.test(date)) {
      return refusal(422, 'InvalidEvent', 'The date must look like 2026-10-14')
    }
    event.date = date
  }
  if ('title' in body) {
    event.title = (bodyText(body, 'title') ?? '').trim()
  }
  if ('epicId' in body) {
    event.epicId = bodyNumber(body, 'epicId')
  }
  if ('note' in body) {
    event.note = bodyText(body, 'note')
  }
  if ('minutes' in body) {
    const minutes = bodyText(body, 'minutes')
    const written = minutes === null || minutes.trim() === '' ? null : minutes
    if (written !== event.minutes) {
      event.minutes = written
      event.minutesUpdatedAt = written === null ? null : env.now().toISOString()
    }
  }
  return null
}

function withRisk(context: DemoContext, work: (risk: ProjectRisk) => DemoReply): DemoReply {
  const risk = context.state.risks.find((candidate) => candidate.id === identifierAt(context))
  return risk === undefined ? refusal(404, 'RiskNotFound', 'This risk does not exist') : work(risk)
}

export const FOLLOW_UP_ROUTES: readonly DemoRoute[] = [
  route('GET', '/api/projects/(\\d+)/events', (context) =>
    reply(eventsOf(context.state, identifierAt(context))),
  ),
  route('GET', '/api/projects/(\\d+)/follow-up', (context) =>
    reply(followUpOf(context.state, identifierAt(context), dayOf(context.env.now()))),
  ),
  route('POST', '/api/events', (context) => {
    const projectId = bodyNumber(context.body, 'projectId')
    if (projectId === null || !context.state.projects.some((project) => project.id === projectId)) {
      return refusal(422, 'InvalidEvent', 'An event belongs to a project')
    }
    const created: ProjectEvent = {
      id: nextIdentifier(context.state),
      type: 'other',
      date: dayOf(context.env.now()),
      title: '',
      projectId,
      epicId: null,
      note: null,
      minutes: null,
      minutesUpdatedAt: null,
    }
    const refused = writeEvent(context, created)
    if (refused !== null) {
      return refused
    }
    context.state.events.push(created)
    return reply(created, 201)
  }),
  route('PATCH', '/api/events/(\\d+)', (context) => {
    const event = context.state.events.find((candidate) => candidate.id === identifierAt(context))
    if (event === undefined) {
      return refusal(404, 'EventNotFound', 'This event does not exist')
    }
    return writeEvent(context, event) ?? reply(event)
  }),
  route('DELETE', '/api/events/(\\d+)', (context) => {
    const eventId = identifierAt(context)
    context.state.events = context.state.events.filter((event) => event.id !== eventId)
    return reply(null, 204)
  }),
  route('PUT', '/api/projects/(\\d+)/weather', (context) => {
    const note = ensureNote(context.state, identifierAt(context))
    if ('weather' in context.body) {
      const weather = bodyText(context.body, 'weather')
      if (weather !== null && !(WEATHERS as readonly string[]).includes(weather)) {
        return refusal(422, 'InvalidWeather', 'Unknown weather')
      }
      note.manual = weather as Weather | null
    }
    if ('statusSentence' in context.body) {
      const sentence = bodyText(context.body, 'statusSentence')
      note.statusSentence = sentence === null || sentence.trim() === '' ? null : sentence.trim()
    }
    return reply(followUpOf(context.state, identifierAt(context), dayOf(context.env.now())))
  }),
  route('POST', '/api/projects/(\\d+)/risks', (context) => {
    const text = bodyText(context.body, 'text')?.trim() ?? ''
    const level = bodyText(context.body, 'level') ?? 'medium'
    if (text === '' || !(RISK_LEVELS as readonly string[]).includes(level)) {
      return refusal(422, 'InvalidRisk', 'A risk needs a text and a level')
    }
    const owner = bodyText(context.body, 'owner')
    const created: ProjectRisk = {
      id: nextIdentifier(context.state),
      projectId: identifierAt(context),
      text,
      level: level as RiskLevel,
      owner: owner === null || owner.trim() === '' ? null : owner.trim(),
      epicId: bodyNumber(context.body, 'epicId'),
      openedOn: dayOf(context.env.now()),
      closedOn: null,
    }
    context.state.risks.push(created)
    return reply(created, 201)
  }),
  route('PATCH', '/api/risks/(\\d+)', (context) =>
    withRisk(context, (risk) => {
      risk.closedOn = context.body.closed === true ? dayOf(context.env.now()) : null
      return reply(risk)
    }),
  ),
  route('POST', '/api/projects/(\\d+)/decisions', (context) => {
    const text = bodyText(context.body, 'text')?.trim() ?? ''
    if (text === '') {
      return refusal(422, 'InvalidDecision', 'A decision needs a text')
    }
    const by = bodyText(context.body, 'decidedBy')?.trim() ?? ''
    const created = {
      id: nextIdentifier(context.state),
      projectId: identifierAt(context),
      decidedOn: dayOf(context.env.now()),
      text,
      decidedBy: by === '' ? context.state.self.login : by,
    }
    context.state.decisions.push(created)
    return reply(created, 201)
  }),
]
