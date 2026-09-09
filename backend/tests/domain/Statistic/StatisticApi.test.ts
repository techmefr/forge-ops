import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStatisticRepository } from '../../../src/domain/Statistic/StatisticRepository.js'
import { createStatisticApi } from '../../../src/domain/Statistic/StatisticApi.js'

let db: Database.Database
let api: Hono

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
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
    businessIntent: 'gerer les mails',
  })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' })
  createAgentSessionRepository(db).registerSession({
    storyId: story.id,
    claudeSessionId: '11111111-1111-1111-1111-111111111111',
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.218',
  })
  api = createStatisticApi({ statistics: createStatisticRepository(db) })
})

describe('GET /api/sessions/history', () => {
  it('serves the sessions the board has run', async () => {
    const response = await api.request('/api/sessions/history')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject([{ agentName: 'neo', phase: 'code' }])
  })
})

describe('GET /api/statistics', () => {
  it('serves the tallies the statistics screen shows', async () => {
    const response = await api.request('/api/statistics')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      sessions: 1,
      agents: [{ agentName: 'neo', sessions: 1 }],
    })
  })
})
