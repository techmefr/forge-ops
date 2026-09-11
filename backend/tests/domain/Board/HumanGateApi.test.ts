import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createHumanGateApi } from '../../../src/domain/Story/HumanGateApi.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import type { StoryState } from '../../../src/domain/Story/Story.js'

let db: Database.Database
let stories: StoryRepository
let api: Hono
let storyId: number
let published: string[]

function ageStory(hours: number): void {
  db.prepare<[number, number]>(
    "UPDATE story SET updated_at = datetime('now', '-' || ? || ' hours') WHERE id = ?",
  ).run(hours, storyId)
}

function park(state: StoryState, hours: number): void {
  stories.moveToState(storyId, state)
  ageStory(hours)
}

function read(): Promise<Response> {
  return api.request('/api/board/human-gates') as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  published = []
  const events = createEventBus()
  events.subscribe((event) => {
    published.push(event.name)
  })
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'un titre', body: 'un corps' }).id
  api = createHumanGateApi({ stories, events })
})

describe('GET /api/board/human-gates', () => {
  it('says how long a human has before the board calls the wait abandoned', async () => {
    await expect((await read()).json()).resolves.toMatchObject({ deadlineMinutes: 1440 })
  })

  it('ignores a story nobody is waiting on', async () => {
    stories.moveToState(storyId, 'building')
    ageStory(200)

    const gates = (await (await read()).json()) as { gates: unknown[] }

    expect(gates.gates).toEqual([])
  })

  it('reports a plan waiting on its reviewer', async () => {
    park('plan_review', 1)

    const body = (await (await read()).json()) as { gates: { reference: string; overdue: boolean }[] }

    expect(body.gates).toMatchObject([{ reference: 'FORGE-1', overdue: false }])
  })

  it('flags a story nobody came to ship', async () => {
    park('shipping', 30)

    const body = (await (await read()).json()) as { gates: { overdue: boolean }[] }

    expect(body.gates[0]?.overdue).toBe(true)
  })

  it('flags an escalated story nobody looked at', async () => {
    park('escalated', 48)

    const body = (await (await read()).json()) as { gates: { overdue: boolean }[] }

    expect(body.gates[0]?.overdue).toBe(true)
  })

  it('leaves the overdue story exactly where it was, the human still decides', async () => {
    park('shipping', 30)

    await read()

    expect(stories.findStory(storyId).state).toBe('shipping')
  })

  it('raises the overdue gate on the bus so the board can shout', async () => {
    park('shipping', 30)

    await read()

    expect(published).toContain('story.gate_overdue')
  })

  it('shouts once, not on every refresh of the board', async () => {
    park('shipping', 30)

    await read()
    await read()

    expect(published.filter((name) => name === 'story.gate_overdue')).toHaveLength(1)
  })

  it('stays quiet while the human is still within the deadline', async () => {
    park('shipping', 2)

    await read()

    expect(published).toEqual([])
  })
})
