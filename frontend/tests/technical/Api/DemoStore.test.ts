import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoStore, type DemoStore } from '@/technical/Api/Demo/DemoStore'
import type { DemoEnvironment, DemoEvent } from '@/technical/Api/Demo/DemoModel'

function epic(id: number, projectId: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, projectId, title: `Subject ${id}`, businessIntent: 'intent', assignee: null, storyCount: 0, priority: 'normal',
    startedOn: null, statusNote: null, requestedBy: null, tags: [], links: [], dependsOn: [], state: 'todo',
    progress: { delivered: 0, total: 0 }, lateDays: null, dueOn: null, nextEvent: null, blockedSince: null,
    waitingOn: [], deletedAt: null, ...extra,
  }
}

function column(id: number, key: string, provider: string, autoStart: boolean): Record<string, unknown> {
  return {
    id, projectId: 1, key, label: key, colour: 'acc', position: id, provider, model: '', effort: provider === 'human' ? '' : 'high',
    agentName: '', command: '', preprompt: '', autoStart, behaviouralKind: 'ordinary',
  }
}

function card(id: number, stepKey: string, status: string): Record<string, unknown> {
  return {
    id, reference: `FORGE-${id}`, storyId: id + 50, storyReference: `FORGE-${id}`, title: 'Card', projectId: 1, subjectId: 1,
    subjectTitle: 'Subject 1', stepKey, provider: 'claude', status, claudeSessionId: null, durationSeconds: 0, costUsd: 0,
  }
}

const SNAPSHOT = {
  '/api/projects': [{ id: 1, slug: 'a', name: 'A', repositoryUrl: '', integrationBranch: 'main', colour: '#ff0000', checkoutPath: null }],
  '/api/projects/sheets': [{ id: 1, slug: 'a', name: 'A', colour: '#ff0000', position: 0, adminUserId: null, adminLogin: null, adminName: null, links: [], usage: 0 }],
  '/api/epics': [epic(1, 1, { assignee: 'local' }), epic(2, 1, { state: 'blocked' })],
  '/api/epics?state=trash': [epic(3, 1, { state: 'trash', deletedAt: '2026-09-01T00:00:00Z' })],
  '/api/tags': [],
  '/api/board-users': [],
  '/api/board/self': { login: 'local', superAdmin: true },
  '/api/projects/1/events': [],
  '/api/projects/1/links': [],
  '/api/projects/1/follow-up': { projectId: 1, statusSentence: null, weather: 'cloudy', source: 'computed', score: {}, alerts: {}, nextEvent: null, risks: [], decisions: [], events: [] },
  '/api/projects/1/workflow-columns': { columns: [column(1, 'architecture', 'claude', true), column(2, 'review', 'human', false), column(3, 'building', 'claude', false)], maySettle: true, admin: null },
  '/api/forge-cards?project=1': [card(1, 'backlog', 'idle'), card(2, 'building', 'idle')],
}

let store: DemoStore
let events: DemoEvent[]
let pending: (() => void)[]

const ENVIRONMENT: DemoEnvironment = {
  emit: (event) => events.push(event),
  later: (_delay, work) => pending.push(work),
  now: () => new Date('2026-09-29T10:00:00'),
}

function read(path: string): unknown {
  return store.handle('GET', path, null).body
}

beforeEach(() => {
  events = []
  pending = []
  store = createDemoStore(SNAPSHOT, ENVIRONMENT)
})

describe('subjects', () => {
  it('serves the trash and the live list apart', () => {
    expect(read('/api/epics?state=trash')).toHaveLength(1)
    expect(read('/api/epics')).toHaveLength(2)
  })

  it('filters by state, assignee and free text', () => {
    expect(read('/api/epics?state=blocked')).toHaveLength(1)
    expect(read('/api/epics?assignee=local')).toHaveLength(1)
    expect(read('/api/epics?assignee=none')).toHaveLength(1)
    expect(read('/api/epics?q=subject%202')).toHaveLength(1)
  })

  it('claims, changes state and records the history', () => {
    store.handle('POST', '/api/epics/2/claim', null)
    store.handle('PATCH', '/api/epics/2', { state: 'doing' })

    expect(read('/api/epics?assignee=local')).toHaveLength(2)
    expect(read('/api/epics/2/history')).toHaveLength(1)
  })

  it('moves a deleted subject to the trash and back', () => {
    store.handle('DELETE', '/api/epics/1', null)
    expect(read('/api/epics?state=trash')).toHaveLength(2)
    store.handle('POST', '/api/epics/1/restore', null)
    expect(read('/api/epics?state=trash')).toHaveLength(1)
  })

  it('creates a subject visible in its project', () => {
    store.handle('POST', '/api/epics', { projectId: 1, title: 'New', businessIntent: 'why' })

    expect(read('/api/projects/1/epics')).toHaveLength(3)
  })
})

describe('follow-up', () => {
  it('turns stormy when high risks pile up, and calm again once closed', () => {
    for (const text of ['a', 'b', 'c']) {
      store.handle('POST', '/api/projects/1/risks', { text, level: 'high' })
    }
    const stormy = read('/api/projects/1/follow-up') as { weather: string; risks: { id: number }[] }
    expect(stormy.weather).toBe('stormy')

    for (const risk of stormy.risks) {
      store.handle('PATCH', `/api/risks/${risk.id}`, { closed: true })
    }
    expect((read('/api/projects/1/follow-up') as { weather: string }).weather).toBe('cloudy')
  })

  it('lets the weather be forced, then released', () => {
    store.handle('PUT', '/api/projects/1/weather', { weather: 'sunny' })
    expect(read('/api/projects/1/follow-up')).toMatchObject({ weather: 'sunny', source: 'manual' })
    store.handle('PUT', '/api/projects/1/weather', { weather: null })
    expect(read('/api/projects/1/follow-up')).toMatchObject({ source: 'computed' })
  })

  it('keeps the minutes of an event', () => {
    const created = store.handle('POST', '/api/events', { projectId: 1, type: 'steering', date: '2026-09-01', title: 'S', minutes: 'done' })
    expect((created.body as { minutesUpdatedAt: string | null }).minutesUpdatedAt).not.toBeNull()
    expect(read('/api/projects/1/events')).toHaveLength(1)
  })
})

describe('workflow', () => {
  it('adds, reorders and removes a step', () => {
    const added = store.handle('POST', '/api/projects/1/workflow-columns', {
      label: 'Design QA', colour: 'violet', provider: 'claude', model: 'claude-sonnet-5', effort: 'high', agentName: '', command: '', preprompt: '', autoStart: false,
    })
    expect(added.status).toBe(201)
    const key = (added.body as { key: string }).key
    expect(key).toBe('design_qa')

    store.handle('PUT', '/api/projects/1/workflow-columns/order', { keysInOrder: [key, 'architecture', 'review', 'building'] })
    const columns = (read('/api/projects/1/workflow-columns') as { columns: { key: string }[] }).columns
    expect(columns[0]?.key).toBe(key)

    const id = (added.body as { id: number }).id
    expect(store.handle('DELETE', `/api/projects/1/workflow-columns/${id}`, null).status).toBe(204)
  })

  it('refuses a duplicate label', () => {
    const refused = store.handle('POST', '/api/projects/1/workflow-columns', {
      label: 'building', colour: 'acc', provider: 'claude', model: 'claude-sonnet-5', effort: 'high', agentName: '', command: '', preprompt: '', autoStart: false,
    })
    expect(refused.status).toBe(422)
  })
})

describe('forge cards', () => {
  it('starts an agent when a card enters an auto-start step, then hands it over for validation', () => {
    const answer = store.handle('POST', '/api/forge-cards/1/move', { stepKey: 'architecture' })
    expect(answer.body).toMatchObject({ started: true, card: { status: 'running' } })
    pending.forEach((work) => work())

    const cards = read('/api/forge-cards?project=1') as { id: number; status: string }[]
    expect(cards.find((held) => held.id === 1)?.status).toBe('to_validate')
    expect(events.map((event) => event.name)).toContain('session.result')
  })

  it('waits for a human in a human step', () => {
    store.handle('POST', '/api/forge-cards/2/move', { stepKey: 'review' })
    const cards = read('/api/forge-cards?project=1') as { id: number; status: string }[]
    expect(cards.find((held) => held.id === 2)?.status).toBe('human_review')
  })

  it('refuses to jump to done', () => {
    expect(store.handle('POST', '/api/forge-cards/1/move', { stepKey: 'done' }).status).toBe(409)
  })

  it('answers a message on the thread', () => {
    store.handle('POST', '/api/stories/52/talk', { message: 'hello' })
    pending.forEach((work) => work())

    const thread = read('/api/stories/52/thread') as { chapters: { entries: { body: string }[] }[] }
    expect(thread.chapters.flatMap((chapter) => chapter.entries)).toHaveLength(2)
  })

  it('adds a backlog card', () => {
    store.handle('POST', '/api/forge-cards/backlog', { subjectId: 1, title: 'Fresh' })
    expect(read('/api/forge-cards?project=1')).toHaveLength(3)
  })
})

describe('team', () => {
  it('creates a project, moves it first and refuses to delete a busy one', () => {
    const created = store.handle('POST', '/api/projects', { slug: 'b', name: 'B', colour: '#00ff00' })
    const id = (created.body as { id: number }).id
    store.handle('PUT', `/api/projects/${id}`, { position: 0 })
    expect((read('/api/projects/sheets') as { id: number }[])[0]?.id).toBe(id)
    expect(store.handle('DELETE', '/api/projects/1', null).status).toBe(409)
    expect(store.handle('DELETE', `/api/projects/${id}`, null).status).toBe(204)
  })

  it('adds a user and changes its capacity', () => {
    store.handle('POST', '/api/board-users', { login: 'ada', displayName: 'Ada', password: 'x', role: 'architect' })
    store.handle('PATCH', '/api/board-users/ada', { capacity: 3 })
    expect(read('/api/board-users')).toMatchObject([{ login: 'ada', capacity: 3 }])
  })

  it('creates, renames and deletes a tag', () => {
    const created = store.handle('POST', '/api/tags', { label: 'ux', colour: '#a855f7' })
    const id = (created.body as { id: number }).id
    store.handle('PATCH', '/api/epics/1', { tagIds: [id] })
    store.handle('PUT', `/api/tags/${id}`, { label: 'design', colour: '#a855f7' })
    expect(read('/api/tags')).toMatchObject([{ label: 'design', usage: 1 }])
    store.handle('DELETE', `/api/tags/${id}`, null)
    expect(read('/api/tags')).toEqual([])
  })
})
