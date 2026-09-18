import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createBatchRepository } from '../../../src/domain/Delivery/BatchRepository.js'
import { createBatchApi } from '../../../src/domain/Delivery/BatchApi.js'
import type { Batch } from '../../../src/domain/Delivery/Grouping.js'

let db: Database.Database
let api: Hono
let stories: ReturnType<typeof createStoryRepository>
let checkpoints: ReturnType<typeof createCheckpointRepository>
let criteria: ReturnType<typeof createCriterionRepository>
let batches: ReturnType<typeof createBatchRepository>
let first: number
let second: number
let admin: boolean

function post(path: string, body: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

function writeStory(epicId: number, title: string): number {
  const story = stories.writeStory({ epicId, title, body: 'un corps' })
  stories.writeTwin({ storyId: story.id, title: `${title} twin`, body: 'twin' })
  return story.id
}

beforeAll(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  criteria = createCriterionRepository(db)
  batches = createBatchRepository(db)
  api = createBatchApi({ batches, maySettle: () => admin })
})

beforeEach(() => {
  admin = true
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'Gerer les mails',
  })
  first = writeStory(epic.id, 'la premiere')
  second = writeStory(epic.id, 'la seconde')
})

afterEach(() => {
  db.exec(
    'DELETE FROM batch_story; DELETE FROM merge_batch; DELETE FROM board_setting;' +
      ' DELETE FROM checkpoint; DELETE FROM acceptance_criterion; DELETE FROM story;' +
      ' DELETE FROM epic; DELETE FROM project; DELETE FROM sqlite_sequence',
  )
})

describe('one story, one merge request', () => {
  it('opens a merge request on its own branch', async () => {
    const response = await post('/api/batches', { storyId: first })
    expect(response.status).toBe(201)
    const batch = (await response.json()) as Batch
    expect(batch.storyIds).toEqual([first])
    expect(batch.branch.startsWith('story/')).toBe(true)
  })

  it('refuses a second story by default', async () => {
    const batch = (await (await post('/api/batches', { storyId: first })).json()) as Batch
    const joined = await post(`/api/batches/${batch.id}/stories`, { storyId: second })
    expect(joined.status).toBe(409)
    expect(await joined.json()).toMatchObject({ refusal: 'GroupingIsOff' })
  })
})

describe('grouping as an option', () => {
  it('is settled by an admin and refused to anyone else', async () => {
    admin = false
    expect((await post('/api/delivery/grouping', { grouping: 'grouped' })).status).toBe(403)
    admin = true
    expect((await post('/api/delivery/grouping', { grouping: 'grouped' })).status).toBe(200)
    expect(batches.grouping()).toBe('grouped')
  })

  it('lets a second story join once the organisation chose it', async () => {
    await post('/api/delivery/grouping', { grouping: 'grouped' })
    const batch = (await (await post('/api/batches', { storyId: first })).json()) as Batch
    const joined = await post(`/api/batches/${batch.id}/stories`, { storyId: second })
    expect(joined.status).toBe(200)
    expect(((await joined.json()) as Batch).storyIds).toEqual([first, second].sort())
  })
})

describe('pulling a story out of a merge request in flight', () => {
  it('gives it its own merge request and leaves the others behind', async () => {
    await post('/api/delivery/grouping', { grouping: 'grouped' })
    const opened = (await (await post('/api/batches', { storyId: first })).json()) as Batch
    await post(`/api/batches/${opened.id}/stories`, { storyId: second })
    const response = await post(`/api/batches/${opened.id}/extract`, { storyId: second })
    expect(response.status).toBe(201)
    const { batch, extracted } = (await response.json()) as { batch: Batch; extracted: Batch }
    expect(batch.storyIds).toEqual([first])
    expect(extracted.storyIds).toEqual([second])
    expect(extracted.branch).not.toBe(batch.branch)
  })

  it('refuses to empty the merge request it pulls from', async () => {
    const opened = (await (await post('/api/batches', { storyId: first })).json()) as Batch
    const response = await post(`/api/batches/${opened.id}/extract`, { storyId: first })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ refusal: 'LastStoryOfTheBatch' })
  })

  it('leaves the proof attached to the story it follows', async () => {
    await post('/api/delivery/grouping', { grouping: 'grouped' })
    const criterion = criteria.declareCriterion({
      storyId: second,
      reference: 'AC-1',
      statement: 'la preuve suit la story',
    })
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/criterion.md')
    checkpoints.proveCheckpoint({
      storyId: second,
      name: 'spec_done',
      evidencePath: '.claude/evidence/spec_done.md',
    })
    const opened = (await (await post('/api/batches', { storyId: first })).json()) as Batch
    await post(`/api/batches/${opened.id}/stories`, { storyId: second })
    await post(`/api/batches/${opened.id}/extract`, { storyId: second })
    expect(checkpoints.listProofs(second).map((proof) => proof.name)).toEqual(['spec_done'])
    expect(checkpoints.listProofs(first)).toEqual([])
  })
})
