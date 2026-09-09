import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'

let api: Hono
let storyId: number

function prove(name: string, evidencePath: string): Promise<Response> {
  return api.request(`/api/stories/${storyId}/checkpoints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, evidencePath }),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer les mails' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas...' })
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db),
    claudeHome: mkdtempSync(join(tmpdir(), 'starfleet-claude-home-')),
  })
})

describe('POST /api/stories/:id/checkpoints', () => {
  it('proves a checkpoint with its evidence', async () => {
    const response = await prove('spec_done', '.claude/evidence/FORGE-1/spec.md')

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      name: 'spec_done',
      evidencePath: '.claude/evidence/FORGE-1/spec.md',
    })
  })

  it('refuses a checkpoint with no evidence', async () => {
    const response = await prove('spec_done', '  ')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'EvidenceRequiredError' })
  })

  it('refuses a checkpoint out of order, without pretending it is a bug', async () => {
    const response = await prove('build_done', '.claude/evidence/FORGE-1/build.md')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'CheckpointOutOfOrderError' })
  })

  it('refuses a checkpoint name outside the sequence', async () => {
    const response = await prove('presque_fini', '.claude/evidence/FORGE-1/x.md')

    expect(response.status).toBe(422)
  })
})

describe('GET /api/stories/:id/dod', () => {
  it('reports the six steps and what is proven', async () => {
    await prove('spec_done', '.claude/evidence/FORGE-1/spec.md')

    const response = await api.request(`/api/stories/${storyId}/dod`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { name: 'spec_done', proven: true, evidencePath: '.claude/evidence/FORGE-1/spec.md' },
      { name: 'arch_done', proven: false, evidencePath: null },
      { name: 'tests_written', proven: false, evidencePath: null },
      { name: 'build_done', proven: false, evidencePath: null },
      { name: 'verified', proven: false, evidencePath: null },
      { name: 'reviewed', proven: false, evidencePath: null },
    ])
  })
})
