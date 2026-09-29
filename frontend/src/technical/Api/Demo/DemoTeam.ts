import { CAPACITY_MAX, CAPACITY_MIN, type BoardUserSheet } from '@contract/ProjectContract'
import type { SubjectLink } from '@contract/EpicContract'
import type { InstanceToken } from '@contract/OrganisationContract'
import type { Project } from '@contract/StoryContract'
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
import { liveEpics } from './DemoSubjects'

function orderedSheets(state: DemoState): DemoState['sheets'] {
  return [...state.sheets].sort((one, other) => one.position - other.position)
}

function renumber(state: DemoState, order: DemoState['sheets']): void {
  order.forEach((sheet, index) => {
    sheet.position = index
  })
  state.projects.sort(
    (one, other) =>
      (state.sheets.find((sheet) => sheet.id === one.id)?.position ?? 0) -
      (state.sheets.find((sheet) => sheet.id === other.id)?.position ?? 0),
  )
}

function sheetsWithUsage(state: DemoState): DemoState['sheets'] {
  for (const sheet of state.sheets) {
    sheet.usage = state.epics.filter((epic) => epic.projectId === sheet.id).length
  }
  return orderedSheets(state)
}

function updateProject(context: DemoContext): DemoReply {
  const { state, body } = context
  const sheet = state.sheets.find((candidate) => candidate.id === identifierAt(context))
  const project = state.projects.find((candidate) => candidate.id === identifierAt(context))
  if (sheet === undefined || project === undefined) {
    return refusal(404, 'ProjectNotFound', 'This project does not exist')
  }
  const colour = bodyText(body, 'colour')
  if (colour !== null) {
    if (!/^#[0-9a-fA-F]{6}$/.test(colour)) {
      return refusal(422, 'InvalidProjectUpdate', 'A colour looks like #ff3b00')
    }
    sheet.colour = colour
    project.colour = colour
  }
  if ('adminId' in body) {
    const admin = state.users.find((user) => user.id === bodyNumber(body, 'adminId'))
    sheet.adminUserId = admin?.id ?? null
    sheet.adminLogin = admin?.login ?? null
    sheet.adminName = admin?.displayName ?? null
  }
  if (Array.isArray(body.links)) {
    const links = body.links as SubjectLink[]
    sheet.links = links
    state.links.set(sheet.id, links)
  }
  const position = bodyNumber(body, 'position')
  if (position !== null) {
    const others = orderedSheets(state).filter((candidate) => candidate.id !== sheet.id)
    others.splice(Math.min(position, others.length), 0, sheet)
    renumber(state, others)
  }
  return reply(sheet)
}

function createProject(context: DemoContext): DemoReply {
  const { state, body } = context
  const name = bodyText(body, 'name')?.trim() ?? ''
  const colour = bodyText(body, 'colour') ?? '#5b8def'
  const asked = bodyText(body, 'slug')?.trim() ?? ''
  const base =
    asked !== ''
      ? asked
      : name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(base) || name === '') {
    return refusal(422, 'InvalidProject', 'A project needs a name')
  }
  if (asked !== '' && state.projects.some((project) => project.slug === asked)) {
    return refusal(409, 'ProjectSlugTakenError', 'This slug is already used')
  }
  let slug = base
  for (let suffix = 2; state.projects.some((project) => project.slug === slug); suffix += 1) {
    slug = `${base}-${suffix}`
  }
  const project: Project = {
    id: nextIdentifier(state),
    slug,
    name,
    repositoryUrl: bodyText(body, 'repositoryUrl') ?? bodyText(body, 'repository') ?? '',
    integrationBranch: bodyText(body, 'integrationBranch') ?? 'main',
    colour,
    checkoutPath: null,
  }
  state.projects.push(project)
  state.sheets.push({
    id: project.id,
    slug,
    name,
    colour,
    position: state.sheets.length,
    adminUserId: null,
    adminLogin: null,
    adminName: null,
    links: [],
    usage: 0,
  })
  state.links.set(project.id, [])
  return reply(project, 201)
}

function removeProject(context: DemoContext): DemoReply {
  const { state } = context
  const projectId = identifierAt(context)
  if (liveEpics(state, projectId).length > 0) {
    return refusal(409, 'ProjectInUse', 'This project still holds subjects')
  }
  state.projects = state.projects.filter((project) => project.id !== projectId)
  state.sheets = state.sheets.filter((sheet) => sheet.id !== projectId)
  state.epics = state.epics.filter((epic) => epic.projectId !== projectId)
  state.columns = state.columns.filter((column) => column.projectId !== projectId)
  state.cards = state.cards.filter((card) => card.projectId !== projectId)
  return reply(null, 204)
}

function changeUser(context: DemoContext): DemoReply {
  const { state, body } = context
  const user = state.users.find((candidate) => candidate.login === context.match[1])
  if (user === undefined) {
    return refusal(404, 'UnknownAccount', 'This account does not exist')
  }
  if ('capacity' in body) {
    const capacity = bodyNumber(body, 'capacity')
    if (capacity !== null && (capacity < CAPACITY_MIN || capacity > CAPACITY_MAX)) {
      return refusal(422, 'InvalidBoardUserChange', 'The capacity is out of range')
    }
    user.capacity = capacity
  }
  if (typeof body.active === 'boolean') {
    user.active = body.active
  }
  if (typeof body.superAdmin === 'boolean') {
    user.superAdmin = body.superAdmin
    if (user.login === state.self.login) {
      state.self.superAdmin = body.superAdmin
    }
  }
  return reply(user)
}

function createUser(context: DemoContext): DemoReply {
  const { state, body } = context
  const login = bodyText(body, 'login')?.trim() ?? ''
  const displayName = bodyText(body, 'displayName')?.trim() ?? ''
  const role = bodyText(body, 'role')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(login) || displayName === '' || (role !== 'director' && role !== 'architect')) {
    return refusal(422, 'InvalidBoardUser', 'A user needs a lowercase login, a name and a role')
  }
  if (state.users.some((user) => user.login === login)) {
    return refusal(409, 'LoginTaken', 'This login is already used')
  }
  const created = {
    id: nextIdentifier(state),
    login,
    displayName,
    role: role as BoardUserSheet['role'],
    superAdmin: false,
    active: true,
    capacity: null,
  }
  state.users.push(created)
  return reply(created, 201)
}

function replaceSingleton(state: DemoState, path: string, change: (current: Record<string, unknown>) => unknown): void {
  state.singletons[path] = change((state.singletons[path] ?? {}) as Record<string, unknown>)
}

export const TEAM_ROUTES: readonly DemoRoute[] = [
  route('GET', '/api/projects', (context) => reply(context.state.projects)),
  route('GET', '/api/projects/sheets', (context) => reply(sheetsWithUsage(context.state))),
  route('POST', '/api/projects', createProject),
  route('PUT', '/api/projects/(\\d+)', updateProject),
  route('DELETE', '/api/projects/(\\d+)', removeProject),
  route('GET', '/api/board-users', (context) => reply(context.state.users)),
  route('GET', '/api/board/self', (context) => reply(context.state.self)),
  route('POST', '/api/board-users', createUser),
  route('PATCH', '/api/board-users/([a-z0-9._-]+)', changeUser),
  route('PUT', '/api/settings/budget', (context) => {
    replaceSingleton(context.state, '/api/settings/budget', (current) => ({
      ...current,
      policy: { ...(current.policy as Record<string, unknown>), ...context.body },
    }))
    return reply(context.state.singletons['/api/settings/budget'])
  }),
  route('POST', '/api/delivery/grouping', (context) => {
    replaceSingleton(context.state, '/api/delivery/grouping', (current) => ({
      ...current,
      grouping: context.body.grouping,
    }))
    return reply(context.state.singletons['/api/delivery/grouping'])
  }),
  route('PUT', '/api/settings/workflow', (context) => {
    const phases = Array.isArray(context.body) ? context.body : context.body.phases
    replaceSingleton(context.state, '/api/settings/workflow', (current) => ({ ...current, phases }))
    return reply(context.state.singletons['/api/settings/workflow'])
  }),
  route('POST', '/api/organisation/providers', (context) => {
    replaceSingleton(context.state, '/api/organisation', (current) => {
      const providers = ((current.providers ?? []) as Record<string, unknown>[]).map((provider) =>
        provider.kind === context.body.kind ? { ...provider, ...context.body } : provider,
      )
      const waysIn = providers.filter((provider) => provider.enabled === true).map((provider) => provider.kind)
      return { ...current, providers, waysIn }
    })
    return reply(context.state.singletons['/api/organisation'])
  }),
  route('POST', '/api/instance/tokens', (context) => {
    const name = bodyText(context.body, 'name')?.trim() ?? ''
    if (name === '') {
      return refusal(422, 'InvalidToken', 'A token needs a name')
    }
    const token: InstanceToken = {
      id: nextIdentifier(context.state),
      organisationId: 1,
      name,
      createdAt: context.env.now().toISOString(),
      lastSeenAt: null,
      revokedAt: null,
    }
    const held = (context.state.singletons['/api/instance/tokens'] ?? []) as InstanceToken[]
    context.state.singletons['/api/instance/tokens'] = [...held, token]
    return reply({ token, secret: `demo-${token.id}-not-a-real-token` }, 201)
  }),
  route('DELETE', '/api/instance/tokens/(\\d+)', (context) => {
    const held = (context.state.singletons['/api/instance/tokens'] ?? []) as { id: number }[]
    context.state.singletons['/api/instance/tokens'] = held.filter((token) => token.id !== identifierAt(context))
    return reply(null, 204)
  }),
  route('PUT', '/api/auth/profile', () => reply({})),
  route('PUT', '/api/auth/password', () => reply({})),
]
