import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createWorkflowRepository,
  type WorkflowRepository,
} from '../../../src/domain/Workflow/WorkflowRepository.js'
import { createWorkflowApi } from '../../../src/domain/Workflow/WorkflowApi.js'
import { SEED_WORKFLOW } from '../../../src/domain/Workflow/Workflow.js'
import type { WorkflowPhaseEntry } from '../../../src/domain/Workflow/Workflow.js'

let api: Hono
let workflow: WorkflowRepository
let admin = true
let db: Database.Database

function ask(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const asked =
    body === undefined
      ? api.request(path, { method })
      : api.request(path, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
  return asked as Promise<Response>
}

beforeAll(() => {
  db = openDatabase(':memory:')
  workflow = createWorkflowRepository(db)
  api = createWorkflowApi({ workflow, maySettle: () => admin })
})

beforeEach(() => {
  admin = true
  db.exec("DELETE FROM board_setting WHERE key = 'workflow.phases'")
})

describe('GET /api/settings/workflow', () => {
  it('donne le workflow seme tant que personne n en a ecrit', async () => {
    const answer = (await (await ask('/api/settings/workflow')).json()) as {
      phases: readonly WorkflowPhaseEntry[]
    }

    expect(answer.phases).toEqual(SEED_WORKFLOW)
  })
})

describe('PUT /api/settings/workflow', () => {
  it('ecrit le workflow et le relit ensuite', async () => {
    const edited = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'code' ? { ...entry, agentName: 'oxydis', preprompt: 'ecris propre' } : entry,
    )

    const written = await ask('/api/settings/workflow', 'PUT', edited)
    expect(written.status).toBe(200)

    const reread = (await (await ask('/api/settings/workflow')).json()) as {
      phases: readonly WorkflowPhaseEntry[]
    }
    expect(reread.phases).toEqual(edited)
  })

  it('refuse un workflow qui perd une phase', async () => {
    const incomplete = SEED_WORKFLOW.filter((entry) => entry.phase !== 'ship')

    const answer = await ask('/api/settings/workflow', 'PUT', incomplete)

    expect(answer.status).toBe(422)
    expect((await answer.json()) as { error: string }).toMatchObject({ error: 'WorkflowRefused' })
  })

  it('refuse quand la personne n est pas admin', async () => {
    admin = false

    const answer = await ask('/api/settings/workflow', 'PUT', SEED_WORKFLOW)

    expect(answer.status).toBe(403)
  })
})
