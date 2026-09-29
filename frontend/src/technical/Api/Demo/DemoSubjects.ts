import {
  MANUAL_EPIC_STATES,
  UNASSIGNED,
  inSubjectFilter,
  type EpicPriority,
  type EpicState,
  type SubjectFilter,
  type SubjectLink,
} from '@contract/EpicContract'
import type { EpicOverview } from '@contract/StoryContract'
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
  type DemoState,
} from './DemoModel'

const PRIORITIES: readonly string[] = ['max', 'high', 'normal', 'low']

const LINK_KINDS: readonly string[] = ['repo', 'speckit', 'graphify', 'doc', 'mockup', 'other']

export function isDeleted(epic: EpicOverview): boolean {
  return epic.deletedAt !== null
}

export function liveEpics(state: DemoState, projectId?: number): EpicOverview[] {
  return state.epics.filter(
    (epic) => !isDeleted(epic) && (projectId === undefined || epic.projectId === projectId),
  )
}

export function refreshWaiting(state: DemoState): void {
  for (const epic of state.epics) {
    epic.waitingOn = epic.dependsOn.flatMap((dependencyId) => {
      const dependency = state.epics.find((candidate) => candidate.id === dependencyId)
      return dependency === undefined || dependency.state === 'done' || isDeleted(dependency)
        ? []
        : [{ id: dependency.id, title: dependency.title }]
    })
  }
}

function findEpic(state: DemoState, epicId: number): EpicOverview | undefined {
  return state.epics.find((epic) => epic.id === epicId)
}

function recordState(context: DemoContext, epic: EpicOverview): void {
  const changes = context.state.history.get(epic.id) ?? []
  changes.push({ state: epic.state, at: context.env.now().toISOString(), by: context.state.self.login })
  context.state.history.set(epic.id, changes)
}

function settle(context: DemoContext, epic: EpicOverview, next: EpicState): void {
  if (epic.state === next) {
    return
  }
  epic.state = next
  epic.blockedSince = next === 'blocked' ? context.env.now().toISOString() : null
  if (next === 'done') {
    epic.lateDays = null
  }
  recordState(context, epic)
}

function matchesText(epic: EpicOverview, text: string): boolean {
  const wanted = text.toLowerCase()
  return epic.title.toLowerCase().includes(wanted) || epic.businessIntent.toLowerCase().includes(wanted)
}

export function epicsMatching(state: DemoState, query: URLSearchParams): EpicOverview[] {
  const filter = (query.get('state') ?? '') as SubjectFilter | ''
  const project = Number(query.get('project') ?? 0)
  const assignee = query.get('assignee') ?? ''
  const tag = Number(query.get('tag') ?? 0)
  const text = query.get('q') ?? ''
  const pool = filter === 'trash' ? state.epics.filter(isDeleted) : liveEpics(state)
  return pool.filter(
    (epic) =>
      (filter === '' || filter === 'trash' || inSubjectFilter(epic, filter)) &&
      (project === 0 || epic.projectId === project) &&
      (assignee === '' || (assignee === UNASSIGNED ? epic.assignee === null : epic.assignee === assignee)) &&
      (tag === 0 || epic.tags.some((held) => held.id === tag)) &&
      (text === '' || matchesText(epic, text)),
  )
}

function validLinks(value: unknown): SubjectLink[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const links = value.flatMap((entry): SubjectLink[] => {
    const candidate = entry as Partial<SubjectLink>
    return typeof candidate.url === 'string' &&
      /^https?:\/\//i.test(candidate.url) &&
      LINK_KINDS.includes(candidate.kind ?? '')
      ? [{ kind: candidate.kind as SubjectLink['kind'], url: candidate.url }]
      : []
  })
  return links.length === value.length ? links : null
}

function numbersOf(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === 'number') : []
}

function applyPatch(context: DemoContext, epic: EpicOverview): DemoReply | null {
  const { body, state } = context
  const priority = bodyText(body, 'priority')
  const title = bodyText(body, 'title')?.trim() ?? ''
  if (title !== '') {
    epic.title = title
  }
  if ('priority' in body) {
    if (priority === null || !PRIORITIES.includes(priority)) {
      return refusal(422, 'InvalidEpicPatch', 'Unknown priority')
    }
    epic.priority = priority as EpicPriority
  }
  const wanted = bodyText(body, 'state')
  if ('state' in body) {
    if (wanted === null || !(MANUAL_EPIC_STATES as readonly string[]).includes(wanted)) {
      return refusal(422, 'InvalidEpicPatch', 'Unknown state')
    }
    settle(context, epic, wanted as EpicState)
  }
  if ('statusNote' in body) {
    const note = bodyText(body, 'statusNote')
    epic.statusNote = note === null || note.trim() === '' ? null : note.trim()
  }
  if ('requestedBy' in body) {
    const requester = bodyText(body, 'requestedBy')
    epic.requestedBy = requester === null || requester.trim() === '' ? null : requester.trim()
  }
  if ('startedOn' in body) {
    epic.startedOn = bodyText(body, 'startedOn')
  }
  if ('tagIds' in body) {
    const chosen = numbersOf(body.tagIds)
    epic.tags = state.tags.filter((tag) => chosen.includes(tag.id))
  }
  if ('links' in body) {
    const links = validLinks(body.links)
    if (links === null) {
      return refusal(422, 'InvalidEpicPatch', 'A link needs a kind and an http address')
    }
    epic.links = links
  }
  if ('dependsOn' in body) {
    const chosen = numbersOf(body.dependsOn).filter((id) => id !== epic.id)
    epic.dependsOn = chosen.filter((id) => findEpic(state, id) !== undefined)
  }
  return null
}

function tally(state: DemoState): void {
  for (const tag of state.tags) {
    tag.usage = liveEpics(state).filter((epic) => epic.tags.some((held) => held.id === tag.id)).length
  }
}

export function tagsWithUsage(state: DemoState): DemoState['tags'] {
  tally(state)
  return [...state.tags].sort((one, other) => one.label.localeCompare(other.label))
}

function tagDraft(body: Record<string, unknown>): { label: string; colour: string } | null {
  const label = bodyText(body, 'label')?.trim() ?? ''
  const colour = bodyText(body, 'colour') ?? ''
  return label === '' || !/^#[0-9a-fA-F]{6}$/.test(colour) ? null : { label, colour }
}

function withEpic(context: DemoContext, work: (epic: EpicOverview) => DemoReply): DemoReply {
  const epic = findEpic(context.state, identifierAt(context))
  return epic === undefined ? refusal(404, 'EpicNotFound', 'This subject does not exist') : work(epic)
}

export const SUBJECT_ROUTES: readonly DemoRoute[] = [
  route('GET', '/api/epics', (context) => reply(epicsMatching(context.state, context.query))),
  route('GET', '/api/projects/(\\d+)/epics', (context) =>
    reply(liveEpics(context.state, identifierAt(context))),
  ),
  route('GET', '/api/epics/(\\d+)/history', (context) =>
    reply(context.state.history.get(identifierAt(context)) ?? []),
  ),
  route('POST', '/api/epics', (context) => {
    const projectId = bodyNumber(context.body, 'projectId')
    const title = bodyText(context.body, 'title')?.trim() ?? ''
    const intent = bodyText(context.body, 'businessIntent')?.trim() ?? ''
    if (projectId === null || title === '') {
      return refusal(422, 'InvalidEpic', 'A subject needs a project and a title')
    }
    const created: EpicOverview = {
      id: nextIdentifier(context.state),
      projectId,
      title,
      businessIntent: intent,
      assignee: null,
      storyCount: 0,
      priority: 'normal',
      startedOn: null,
      statusNote: null,
      requestedBy: null,
      tags: [],
      links: [],
      dependsOn: [],
      state: 'todo',
      progress: { delivered: 0, total: 0 },
      lateDays: null,
      dueOn: null,
      nextEvent: null,
      blockedSince: null,
      waitingOn: [],
      deletedAt: null,
    }
    const refused = applyPatch(context, created)
    if (refused !== null) {
      return refused
    }
    created.assignee = bodyText(context.body, 'assignee')
    context.state.epics.push(created)
    recordState(context, created)
    refreshWaiting(context.state)
    return reply(created, 201)
  }),
  route('PATCH', '/api/epics/(\\d+)', (context) =>
    withEpic(context, (epic) => {
      const refused = applyPatch(context, epic)
      refreshWaiting(context.state)
      return refused ?? reply(epic)
    }),
  ),
  route('POST', '/api/epics/(\\d+)/claim', (context) =>
    withEpic(context, (epic) => {
      epic.assignee = context.state.self.login
      return reply(epic)
    }),
  ),
  route('PUT', '/api/epics/(\\d+)/assignee', (context) =>
    withEpic(context, (epic) => {
      epic.assignee = bodyText(context.body, 'login')
      return reply(epic)
    }),
  ),
  route('DELETE', '/api/epics/(\\d+)/claim', (context) =>
    withEpic(context, (epic) => {
      epic.assignee = null
      return reply(epic)
    }),
  ),
  route('DELETE', '/api/epics/(\\d+)', (context) =>
    withEpic(context, (epic) => {
      epic.deletedAt = context.env.now().toISOString()
      epic.state = 'trash'
      recordState(context, epic)
      refreshWaiting(context.state)
      return reply(null, 204)
    }),
  ),
  route('POST', '/api/epics/(\\d+)/restore', (context) =>
    withEpic(context, (epic) => {
      epic.deletedAt = null
      epic.state = 'todo'
      recordState(context, epic)
      refreshWaiting(context.state)
      return reply(epic)
    }),
  ),
  route('GET', '/api/tags', (context) => reply(tagsWithUsage(context.state))),
  route('POST', '/api/tags', (context) => {
    const draft = tagDraft(context.body)
    if (draft === null) {
      return refusal(422, 'InvalidTag', 'A tag needs a label and a colour')
    }
    if (context.state.tags.some((tag) => tag.label.toLowerCase() === draft.label.toLowerCase())) {
      return refusal(409, 'TagLabelTaken', 'This tag already exists')
    }
    const created = { id: nextIdentifier(context.state), ...draft, usage: 0 }
    context.state.tags.push(created)
    return reply(created, 201)
  }),
  route('PUT', '/api/tags/(\\d+)', (context) => {
    const tag = context.state.tags.find((candidate) => candidate.id === identifierAt(context))
    const draft = tagDraft(context.body)
    if (tag === undefined || draft === null) {
      return refusal(tag === undefined ? 404 : 422, 'InvalidTag', 'This tag cannot be saved')
    }
    tag.label = draft.label
    tag.colour = draft.colour
    for (const epic of context.state.epics) {
      epic.tags = epic.tags.map((held) => (held.id === tag.id ? { ...tag } : held))
    }
    return reply(tag)
  }),
  route('DELETE', '/api/tags/(\\d+)', (context) => {
    const tagId = identifierAt(context)
    context.state.tags = context.state.tags.filter((tag) => tag.id !== tagId)
    for (const epic of context.state.epics) {
      epic.tags = epic.tags.filter((held) => held.id !== tagId)
    }
    return reply(null, 204)
  }),
  route('GET', '/api/projects/(\\d+)/links', (context) =>
    reply(context.state.links.get(identifierAt(context)) ?? []),
  ),
  route('PUT', '/api/projects/(\\d+)/links', (context) => {
    const links = validLinks(context.body.links)
    if (links === null) {
      return refusal(422, 'InvalidLinks', 'A link needs a kind and an http address')
    }
    context.state.links.set(identifierAt(context), links)
    return reply(links)
  }),
]
