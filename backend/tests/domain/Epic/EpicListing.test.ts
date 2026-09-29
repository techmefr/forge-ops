import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { buildTestBoard } from '../Board/TestBoard.js'

let db: Database.Database
let api: Hono
let stories: StoryRepository
let forge: number
let skera: number
let cloudmail: number
let billing: number
let search: number
let tagId: number

function call(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

async function titles(query: string): Promise<string[]> {
  const response = await call(`/api/epics${query}`)
  expect(response.status).toBe(200)
  return ((await response.json()) as { title: string }[]).map((epic) => epic.title).sort()
}

function twinnedStory(target: number, title: string): number {
  const story = stories.writeStory({ epicId: target, title, body: 'body' })
  stories.writeTwin({ storyId: story.id, title: `${title} test`, body: 'body' })
  return story.id
}

beforeEach(async () => {
  db = openDatabase(':memory:')
  api = buildTestBoard(db).api
  stories = createStoryRepository(db)
  const draft = { repositoryUrl: 'git@example.com:x.git', integrationBranch: 'main', colour: '#ff3b00' }
  forge = stories.createProject({ slug: 'forge', name: 'Forge', ...draft }).id
  skera = stories.createProject({ slug: 'skera', name: 'Skera', ...draft }).id
  cloudmail = stories.createEpic({ projectId: forge, title: 'Cloudmail', businessIntent: 'Mail' }).id
  billing = stories.createEpic({ projectId: skera, title: 'Billing', businessIntent: 'Bills' }).id
  search = stories.createEpic({ projectId: skera, title: 'Search', businessIntent: 'Find' }).id
  stories.claimEpic(cloudmail, 'gaetan')
  stories.claimEpic(billing, 'anna')
  tagId = ((await (await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })).json()) as { id: number }).id
  await call(`/api/epics/${search}`, 'PATCH', { tagIds: [tagId], statusNote: 'Waiting for the vendor', requestedBy: 'Anthony' })
})

describe('GET /api/epics', () => {
  it('lists the live subjects of every project with what the planning adds', async () => {
    const response = await call('/api/epics')
    const listed = (await response.json()) as Record<string, unknown>[]
    expect(listed).toHaveLength(3)
    expect(listed.find((epic) => epic.id === search)).toMatchObject({
      projectId: skera,
      assignee: null,
      priority: 'normal',
      state: 'todo',
      tags: [{ id: tagId, label: 'Urgent' }],
      progress: { delivered: 0, total: 0 },
      waitingOn: [],
      deletedAt: null,
    })
  })

  it('filters by project', async () => {
    expect(await titles(`?project=${skera}`)).toEqual(['Billing', 'Search'])
  })

  it('filters by assignee, and by none for the unassigned', async () => {
    expect(await titles('?assignee=gaetan')).toEqual(['Cloudmail'])
    expect(await titles('?assignee=none')).toEqual(['Search'])
  })

  it('filters by tag', async () => {
    expect(await titles(`?tag=${tagId}`)).toEqual(['Search'])
  })

  it('searches the title, the note and the requester without regard to case', async () => {
    expect(await titles('?q=cloud')).toEqual(['Cloudmail'])
    expect(await titles('?q=VENDOR')).toEqual(['Search'])
    expect(await titles('?q=anthony')).toEqual(['Search'])
  })

  it('ignores blank parameters', async () => {
    expect(await titles('?project=&assignee=&state=&tag=&q=')).toEqual(['Billing', 'Cloudmail', 'Search'])
  })

  it('combines filters', async () => {
    expect(await titles(`?project=${skera}&assignee=anna`)).toEqual(['Billing'])
  })

  it('filters by state and groups open ones together', async () => {
    stories.moveToState(twinnedStory(billing, 'One'), 'done')
    stories.epics.recordState(billing)
    const started = twinnedStory(cloudmail, 'Two')
    stories.moveToState(started, 'building')
    expect(await titles('?state=done')).toEqual(['Billing'])
    expect(await titles('?state=doing')).toEqual(['Cloudmail'])
    expect(await titles('?state=todo')).toContain('Search')
    expect(await titles('?state=open')).toEqual(['Cloudmail', 'Search'])
    expect(await titles('?state=blocked')).toEqual([])
  })

  it('filters the late ones', async () => {
    stories.writeMilestone({ epicId: cloudmail, kind: 'demo', dueOn: '2020-01-01' })
    stories.writeMilestone({ epicId: search, kind: 'demo', dueOn: '2999-01-01' })
    expect(await titles('?state=late')).toEqual(['Cloudmail'])
  })

  it('shows the deleted subjects only for the trash state', async () => {
    await call(`/api/epics/${billing}`, 'DELETE')
    expect(await titles('')).toEqual(['Cloudmail', 'Search'])
    expect(await titles('?state=trash')).toEqual(['Billing'])
    const trashed = (await (await call('/api/epics?state=trash')).json()) as { deletedAt: string | null }[]
    expect(trashed[0]?.deletedAt).not.toBeNull()
  })

  it('refuses a state it does not know', async () => {
    expect((await call('/api/epics?state=everything')).status).toBe(422)
  })

  it('refuses a parameter it does not know', async () => {
    expect((await call('/api/epics?colour=red')).status).toBe(422)
  })
})

describe('the state of a subject without stories', () => {
  it('takes the state the row asks for and records it in the history', async () => {
    const response = await call(`/api/epics/${search}`, 'PATCH', { state: 'doing' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: search, state: 'doing' })
    expect(await titles('?state=doing')).toEqual(['Search'])
    const history = (await (await call(`/api/epics/${search}/history`)).json()) as { state: string }[]
    expect(history.at(-1)?.state).toBe('doing')
  })

  it('shows blocked since the change and can go back to to do', async () => {
    await call(`/api/epics/${search}`, 'PATCH', { state: 'blocked' })
    const blocked = (await (await call('/api/epics?state=blocked')).json()) as { blockedSince: string | null }[]
    expect(blocked[0]?.blockedSince).not.toBeNull()
    await call(`/api/epics/${search}`, 'PATCH', { state: 'todo' })
    expect(await titles('?state=todo')).toContain('Search')
  })

  it('refuses the trash state, which has its own routes', async () => {
    expect((await call(`/api/epics/${search}`, 'PATCH', { state: 'trash' })).status).toBe(422)
  })

  it('refuses to override a state derived from stories', async () => {
    twinnedStory(billing, 'One')
    const response = await call(`/api/epics/${billing}`, 'PATCH', { state: 'done' })
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toBe('EpicStateDerivedError')
  })

  it('gives the state back to the stories once the first one exists', async () => {
    await call(`/api/epics/${search}`, 'PATCH', { state: 'done' })
    twinnedStory(search, 'One')
    expect(await titles('?state=done')).toEqual([])
    expect(await titles('?state=todo')).toContain('Search')
  })
})
