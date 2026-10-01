import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import type { ProjectFollowUp, ProjectRisk } from '../../../../contract/FollowUpContract.js'
import { buildTestBoard } from '../Board/TestBoard.js'

const TODAY = '2026-09-29'

type Body = Record<string, unknown>

let db: Database.Database
let api: Hono
let stories: StoryRepository
let projectId: number
let otherProjectId: number
let epicId: number
let foreignEpicId: number
let day = TODAY

function call(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

async function followUp(): Promise<ProjectFollowUp> {
  const response = await call(`/api/projects/${projectId}/follow-up`, 'GET')
  expect(response.status).toBe(200)
  return (await response.json()) as ProjectFollowUp
}

async function risk(body: Body): Promise<ProjectRisk> {
  const response = await call(`/api/projects/${projectId}/risks`, 'POST', body)
  expect(response.status).toBe(201)
  return (await response.json()) as ProjectRisk
}

async function patched(riskId: number, body: Body): Promise<ProjectRisk> {
  const response = await call(`/api/risks/${riskId}`, 'PATCH', body)
  expect(response.status).toBe(200)
  return (await response.json()) as ProjectRisk
}

async function lateEpic(title: string): Promise<number> {
  const id = stories.createEpic({ projectId, title, businessIntent: 'x' }).id
  const response = await call('/api/events', 'POST', { projectId, type: 'demo', date: '2026-09-20', epicId: id })
  expect(response.status).toBe(201)
  return id
}

function blockedEpic(title: string): number {
  const id = stories.createEpic({ projectId, title, businessIntent: 'x' }).id
  const story = stories.writeStory({ epicId: id, title, body: 'body' })
  stories.writeTwin({ storyId: story.id, title: `${title} test`, body: 'body' })
  stories.moveToState(story.id, 'building')
  stories.blockStory(story.id, 'waiting')
  return id
}

beforeEach(() => {
  day = TODAY
  db = openDatabase(':memory:')
  api = buildTestBoard(db, () => day).api
  stories = createStoryRepository(db)
  const draft = { repositoryUrl: 'git@example.com:x.git', integrationBranch: 'main', colour: '#ff3b00' }
  projectId = stories.createProject({ slug: 'forge', name: 'Forge', ...draft }).id
  otherProjectId = stories.createProject({ slug: 'skera', name: 'Skera', ...draft }).id
  epicId = stories.createEpic({ projectId, title: 'Cloudmail', businessIntent: 'Mail' }).id
  foreignEpicId = stories.createEpic({ projectId: otherProjectId, title: 'Billing', businessIntent: 'Bills' }).id
})

describe('GET /api/projects/:id/follow-up', () => {
  it('is sunny and quiet for a project with nothing to report', async () => {
    expect(await followUp()).toMatchObject({
      projectId,
      statusSentence: null,
      weather: 'sunny',
      source: 'computed',
      score: { late: 0, blocked: 0, highRisks: 0, total: 0 },
      alerts: { late: 0, blocked: 0, highRisks: 0, minutesToWrite: 0 },
      nextEvent: null,
      risks: [],
      decisions: [],
      events: [],
    })
  })

  it('adds late subjects, blocked subjects and open high risks into one score', async () => {
    await lateEpic('Late one')
    blockedEpic('Blocked one')
    await risk({ text: 'Vendor may slip', level: 'high' })
    const body = await followUp()
    expect(body.score).toEqual({ late: 1, blocked: 1, highRisks: 1, total: 3 })
    expect(body.weather).toBe('cloudy')
    expect(body.alerts).toMatchObject({ late: 1, blocked: 1, highRisks: 1 })
  })

  it('turns stormy from four points', async () => {
    await risk({ text: 'One', level: 'high' })
    await risk({ text: 'Two', level: 'high' })
    await risk({ text: 'Three', level: 'high' })
    expect((await followUp()).weather).toBe('cloudy')
    await risk({ text: 'Four', level: 'high' })
    expect((await followUp()).weather).toBe('stormy')
  })

  it('ignores medium, low and closed risks', async () => {
    await risk({ text: 'Medium', level: 'medium' })
    await risk({ text: 'Low', level: 'low' })
    const high = await risk({ text: 'High', level: 'high' })
    await patched(high.id, { closed: true })
    expect((await followUp()).score.highRisks).toBe(0)
  })

  it('does not count the subjects of another project', async () => {
    await call('/api/events', 'POST', {
      projectId: otherProjectId,
      type: 'demo',
      date: '2026-09-01',
      epicId: foreignEpicId,
    })
    expect((await followUp()).score.late).toBe(0)
  })

  it('drops the events of a deleted subject from the alerts and brings them back on restore', async () => {
    await call('/api/events', 'POST', { projectId, type: 'client', date: '2026-09-15', title: 'Past', epicId })
    expect((await followUp()).alerts.minutesToWrite).toBe(1)

    stories.epics.softDelete(epicId, 'gaetan')
    const hidden = await followUp()
    expect(hidden.alerts.minutesToWrite).toBe(0)
    expect(hidden.events).toHaveLength(0)

    stories.epics.restore(epicId, 'gaetan')
    expect((await followUp()).alerts.minutesToWrite).toBe(1)
  })

  it('lists the minutes to write and the next event', async () => {
    await call('/api/events', 'POST', { projectId, type: 'steering', date: '2026-09-15', title: 'Past' })
    await call('/api/events', 'POST', { projectId, type: 'client', date: '2026-10-05', title: 'Soon' })
    await call('/api/events', 'POST', { projectId, type: 'client', date: '2026-11-05', title: 'Later' })
    const body = await followUp()
    expect(body.alerts.minutesToWrite).toBe(1)
    expect(body.nextEvent).toMatchObject({ title: 'Soon' })
    expect(body.events).toHaveLength(3)
  })

  it('refuses a project that does not exist', async () => {
    expect((await call('/api/projects/999/follow-up', 'GET')).status).toBe(409)
  })

  it('answers 422 for a malformed identifier', async () => {
    expect((await call('/api/projects/abc/follow-up', 'GET')).status).toBe(422)
  })
})

describe('POST /api/projects/:id/risks', () => {
  it('opens a risk today, at medium level when none is given', async () => {
    expect(await risk({ text: 'Vendor may slip' })).toMatchObject({
      projectId,
      text: 'Vendor may slip',
      level: 'medium',
      owner: null,
      epicId: null,
      openedOn: TODAY,
      closedOn: null,
    })
  })

  it('links the risk to a subject of the project', async () => {
    expect(await risk({ text: 'Risky', epicId, owner: 'gaetan' })).toMatchObject({ epicId, owner: 'gaetan' })
  })

  it('refuses a subject of another project', async () => {
    const response = await call(`/api/projects/${projectId}/risks`, 'POST', { text: 'Risky', epicId: foreignEpicId })
    expect(response.status).toBe(409)
  })

  it('refuses an empty text and an unknown level', async () => {
    expect((await call(`/api/projects/${projectId}/risks`, 'POST', { text: '  ' })).status).toBe(422)
    expect((await call(`/api/projects/${projectId}/risks`, 'POST', { text: 'x', level: 'huge' })).status).toBe(422)
  })

  it('lists open risks before closed ones, high before low', async () => {
    await risk({ text: 'Low', level: 'low' })
    await risk({ text: 'High', level: 'high' })
    const closed = await risk({ text: 'Closed high', level: 'high' })
    await patched(closed.id, { closed: true })
    const texts = (await followUp()).risks.map((entry) => entry.text)
    expect(texts).toEqual(['High', 'Low', 'Closed high'])
  })
})

describe('PATCH /api/risks/:id', () => {
  it('closes a risk on the current day and reopens it', async () => {
    const opened = await risk({ text: 'High', level: 'high' })
    day = '2026-10-02'
    expect(await patched(opened.id, { closed: true })).toMatchObject({ closedOn: '2026-10-02' })
    expect(await patched(opened.id, { closed: false })).toMatchObject({ closedOn: null })
  })

  it('keeps the first closing date when closed twice', async () => {
    const opened = await risk({ text: 'High' })
    await patched(opened.id, { closed: true })
    day = '2026-10-05'
    expect(await patched(opened.id, { closed: true })).toMatchObject({ closedOn: TODAY })
  })

  it('edits the text, level, owner and subject', async () => {
    const opened = await risk({ text: 'Old' })
    expect(await patched(opened.id, { text: 'New', level: 'high', owner: 'anna', epicId })).toMatchObject({
      text: 'New',
      level: 'high',
      owner: 'anna',
      epicId,
    })
    expect(await patched(opened.id, { owner: null, epicId: null })).toMatchObject({ owner: null, epicId: null })
  })

  it('refuses a subject of another project', async () => {
    const opened = await risk({ text: 'Old' })
    expect((await call(`/api/risks/${opened.id}`, 'PATCH', { epicId: foreignEpicId })).status).toBe(409)
  })

  it('answers 404 for an unknown risk and 422 for an unknown field', async () => {
    expect((await call('/api/risks/999', 'PATCH', { closed: true })).status).toBe(404)
    const opened = await risk({ text: 'Old' })
    expect((await call(`/api/risks/${opened.id}`, 'PATCH', { colour: 'red' })).status).toBe(422)
  })
})

describe('POST /api/projects/:id/decisions', () => {
  it('records a decision today, by the caller by default', async () => {
    const response = await call(`/api/projects/${projectId}/decisions`, 'POST', { text: 'Ship in October' })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      projectId,
      decidedOn: TODAY,
      text: 'Ship in October',
      decidedBy: 'local',
    })
  })

  it('takes the date and the decider given, and lists the latest first', async () => {
    await call(`/api/projects/${projectId}/decisions`, 'POST', {
      text: 'Older',
      decidedOn: '2026-09-01',
      decidedBy: 'Anna',
    })
    await call(`/api/projects/${projectId}/decisions`, 'POST', {
      text: 'Newer',
      decidedOn: '2026-09-20',
      decidedBy: 'Luca',
    })
    const decisions = (await followUp()).decisions
    expect(decisions.map((entry) => entry.text)).toEqual(['Newer', 'Older'])
    expect(decisions[0]).toMatchObject({ decidedBy: 'Luca' })
  })

  it('refuses an empty text and an unknown project', async () => {
    expect((await call(`/api/projects/${projectId}/decisions`, 'POST', { text: '' })).status).toBe(422)
    expect((await call('/api/projects/999/decisions', 'POST', { text: 'x' })).status).toBe(409)
  })
})

describe('PUT /api/projects/:id/weather', () => {
  it('sets the weather by hand and keeps it whatever the score', async () => {
    const response = await call(`/api/projects/${projectId}/weather`, 'PUT', { weather: 'sunny' })
    expect(response.status).toBe(200)
    for (const text of ['a', 'b', 'c', 'd', 'e']) {
      await risk({ text, level: 'high' })
    }
    expect(await followUp()).toMatchObject({ weather: 'sunny', source: 'manual', score: { total: 5 } })
  })

  it('goes back to automatic with null', async () => {
    await call(`/api/projects/${projectId}/weather`, 'PUT', { weather: 'stormy' })
    await call(`/api/projects/${projectId}/weather`, 'PUT', { weather: null })
    expect(await followUp()).toMatchObject({ weather: 'sunny', source: 'computed' })
  })

  it('writes the status sentence without touching the weather', async () => {
    await call(`/api/projects/${projectId}/weather`, 'PUT', { weather: 'cloudy' })
    await call(`/api/projects/${projectId}/weather`, 'PUT', { statusSentence: '  On track for October  ' })
    expect(await followUp()).toMatchObject({
      weather: 'cloudy',
      source: 'manual',
      statusSentence: 'On track for October',
    })
  })

  it('clears the status sentence', async () => {
    await call(`/api/projects/${projectId}/weather`, 'PUT', { statusSentence: 'Something' })
    await call(`/api/projects/${projectId}/weather`, 'PUT', { statusSentence: null })
    expect((await followUp()).statusSentence).toBeNull()
  })

  it('refuses an unknown weather, an empty body and an unknown project', async () => {
    expect((await call(`/api/projects/${projectId}/weather`, 'PUT', { weather: 'foggy' })).status).toBe(422)
    expect((await call(`/api/projects/${projectId}/weather`, 'PUT', {})).status).toBe(422)
    expect((await call('/api/projects/999/weather', 'PUT', { weather: 'sunny' })).status).toBe(409)
  })
})
