import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createWorkflowColumnApi } from '../../../src/domain/Workflow/WorkflowColumnApi.js'
import type {
  ProjectWorkflow,
  WorkflowColumn,
  WorkflowColumnDraft,
} from '../../../../contract/WorkflowColumnContract.js'

let db: Database.Database
let api: Hono
let admins: Set<number>
let alpha: number
let beta: number

const SPEC: WorkflowColumnDraft = {
  label: 'Spec',
  colour: '#7C3AED',
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
  agentName: '',
  command: '/speckit.specify',
  preprompt: 'Read the epic.',
  autoStart: true,
}

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

function insertProject(slug: string): number {
  return Number(
    db
      .prepare(
        'INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)',
      )
      .run(slug, slug, 'url', 'main', '#112233').lastInsertRowid,
  )
}

beforeEach(() => {
  db = openDatabase(':memory:')
  alpha = insertProject('alpha')
  beta = insertProject('beta')
  admins = new Set([alpha, beta])
  api = createWorkflowColumnApi({
    columns: createWorkflowColumnRepository(db),
    projectExists: (projectId) => projectId === alpha || projectId === beta,
    mayAdminister: (projectId) => admins.has(projectId),
    adminOf: (projectId) => (projectId === alpha ? { login: 'ana', name: 'Ana' } : null),
  })
})

async function create(projectId: number, draft: WorkflowColumnDraft): Promise<WorkflowColumn> {
  const answer = await ask(`/api/projects/${projectId}/workflow-columns`, 'POST', draft)
  return ((await answer.json()) as { column: WorkflowColumn }).column
}

describe('GET /api/projects/:id/workflow-columns', () => {
  it('answers an empty workflow with the admin and whether the caller may settle', async () => {
    const answer = await ask(`/api/projects/${alpha}/workflow-columns`)

    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({
      columns: [],
      maySettle: true,
      admin: { login: 'ana', name: 'Ana' },
    })
  })

  it('is readable by a member who is not the admin', async () => {
    await create(alpha, SPEC)
    admins.clear()

    const workflow = (await (await ask(`/api/projects/${alpha}/workflow-columns`)).json()) as ProjectWorkflow

    expect(workflow.maySettle).toBe(false)
    expect(workflow.columns.map((column) => column.label)).toEqual(['Spec'])
  })

  it('answers 404 for an unknown project', async () => {
    expect((await ask('/api/projects/999/workflow-columns')).status).toBe(404)
  })
})

describe('writes by the project admin', () => {
  it('creates a step', async () => {
    const answer = await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', SPEC)

    expect(answer.status).toBe(201)
    expect(((await answer.json()) as { column: WorkflowColumn }).column).toMatchObject({
      key: 'spec',
      position: 1,
      projectId: alpha,
    })
  })

  it('updates a step', async () => {
    const created = await create(alpha, SPEC)

    const answer = await ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'PUT', {
      ...SPEC,
      effort: 'max',
    })

    expect(answer.status).toBe(200)
    expect(((await answer.json()) as { column: WorkflowColumn }).column.effort).toBe('max')
  })

  it('reorders the steps', async () => {
    await create(alpha, SPEC)
    await create(alpha, { ...SPEC, label: 'Build' })

    const answer = await ask(`/api/projects/${alpha}/workflow-columns/order`, 'PUT', {
      keysInOrder: ['build', 'spec'],
    })

    expect(answer.status).toBe(200)
    expect(((await answer.json()) as { columns: WorkflowColumn[] }).columns.map((column) => column.key)).toEqual([
      'build',
      'spec',
    ])
  })

  it('deletes a step and answers the remaining ones', async () => {
    const created = await create(alpha, SPEC)

    const answer = await ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'DELETE')

    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ columns: [] })
  })

  it('answers 409 while the step holds stories', async () => {
    const created = await create(alpha, { ...SPEC, label: 'Building' })
    const epic = Number(
      db
        .prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)')
        .run(alpha, 'Epic', 'intent').lastInsertRowid,
    )
    db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (?, 'S-1', 't', 'b', 'functional', 'building')",
    ).run(epic)

    const answer = await ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'DELETE')

    expect(answer.status).toBe(409)
    expect(((await answer.json()) as { stories: number }).stories).toBe(1)
  })

  it('answers 422 with the refusal for a model the provider does not offer', async () => {
    const answer = await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', { ...SPEC, model: 'gpt-9' })

    expect(answer.status).toBe(422)
    expect(((await answer.json()) as { refusal: { reason: string } }).refusal.reason).toBe('ModelNotOfProvider')
  })

  it('answers 422 for a body that is not a step', async () => {
    expect((await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', { label: 'x' })).status).toBe(422)
    expect((await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', { ...SPEC, effort: 'extreme' })).status).toBe(422)
  })

  it('answers 404 for a step of another project', async () => {
    const created = await create(beta, SPEC)

    expect((await ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'PUT', SPEC)).status).toBe(404)
    expect((await ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'DELETE')).status).toBe(404)
  })
})

describe('writes by anyone else', () => {
  it('answers 403 on every write, and changes nothing', async () => {
    const created = await create(alpha, SPEC)
    admins.clear()

    const answers = await Promise.all([
      ask(`/api/projects/${alpha}/workflow-columns`, 'POST', { ...SPEC, label: 'Other' }),
      ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'PUT', { ...SPEC, effort: 'low' }),
      ask(`/api/projects/${alpha}/workflow-columns/order`, 'PUT', { keysInOrder: ['spec'] }),
      ask(`/api/projects/${alpha}/workflow-columns/${created.id}`, 'DELETE'),
    ])

    expect(answers.map((answer) => answer.status)).toEqual([403, 403, 403, 403])
    const after = (await (await ask(`/api/projects/${alpha}/workflow-columns`)).json()) as ProjectWorkflow
    expect(after.columns).toEqual([created])
  })

  it('answers 403 before looking at the body', async () => {
    admins.clear()

    expect((await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', { nonsense: true })).status).toBe(403)
  })

  it('does not leak the admin of one project to write on another', async () => {
    admins = new Set([beta])

    expect((await ask(`/api/projects/${alpha}/workflow-columns`, 'POST', SPEC)).status).toBe(403)
    expect((await ask(`/api/projects/${beta}/workflow-columns`, 'POST', SPEC)).status).toBe(201)
  })
})
