import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createTemplateRepository,
  type TemplateRepository,
} from '../../../src/domain/Template/TemplateRepository.js'
import { createTemplateApi } from '../../../src/domain/Template/TemplateApi.js'
import { SHIPPED_TEMPLATE, toJsonl } from '../../../src/domain/Template/Template.js'
import type { ColumnTemplate } from '../../../src/domain/Template/Template.js'

let api: Hono
let templates: TemplateRepository
let projectId: number
let admin = true
let db: Database.Database

function ask(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const asked =
    body === undefined
      ? api.request(path, { method })
      : api.request(path, {
          method,
          headers: { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        })
  return asked as Promise<Response>
}

beforeAll(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  templates = createTemplateRepository(db)
  api = createTemplateApi({ templates, maySettle: () => admin })
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: 'acc',
  }).id
})

beforeEach(() => {
  admin = true
  db.exec('DELETE FROM project_template; DELETE FROM template_column; DELETE FROM column_template')
})

describe('GET /api/templates', () => {
  it('donne le modele livre tant que personne n en a ecrit', async () => {
    const answer = (await (await ask('/api/templates')).json()) as {
      defaultTemplate: ColumnTemplate
    }

    expect(answer.defaultTemplate.slug).toBe('shipped')
    expect(answer.defaultTemplate.columns).toHaveLength(SHIPPED_TEMPLATE.columns.length)
  })

  it('dit si celui qui regarde peut trancher', async () => {
    admin = false

    const answer = (await (await ask('/api/templates')).json()) as { maySettle: boolean }

    expect(answer.maySettle).toBe(false)
  })
})


describe('POST /api/templates', () => {
  it('refuse un modele a qui n est pas admin', async () => {
    admin = false

    expect((await ask('/api/templates', 'POST', SHIPPED_TEMPLATE)).status).toBe(403)
  })

  it('refuse un modele qui perd une etape', async () => {
    const cut = {
      ...SHIPPED_TEMPLATE,
      slug: 'cut',
      columns: SHIPPED_TEMPLATE.columns.filter((column) => column.state !== 'gating'),
    }

    const answer = await ask('/api/templates', 'POST', cut)

    expect(answer.status).toBe(422)
    expect(((await answer.json()) as { refusal: unknown }).refusal).toEqual({
      reason: 'MissingStage',
      stage: 'gating',
    })
  })

  it('ecrit une version de plus a chaque fois, jamais par dessus', async () => {
    const first = (await (
      await ask('/api/templates', 'POST', { ...SHIPPED_TEMPLATE, slug: 'team' })
    ).json()) as ColumnTemplate
    const second = (await (
      await ask('/api/templates', 'POST', { ...SHIPPED_TEMPLATE, slug: 'team' })
    ).json()) as ColumnTemplate

    expect(first.version).toBe(1)
    expect(second.version).toBe(2)
    expect(second.id).not.toBe(first.id)
  })
})


describe('le voyage par fichier', () => {
  it('exporte un modele en jsonl et le relit', async () => {
    const written = (await (
      await ask('/api/templates', 'POST', { ...SHIPPED_TEMPLATE, slug: 'team' })
    ).json()) as ColumnTemplate

    const exported = (await (await ask(`/api/templates/${written.id}/jsonl`)).json()) as { jsonl: string }
    const read = await ask('/api/templates/jsonl', 'POST', { jsonl: exported.jsonl })

    expect(read.status).toBe(201)
    expect(((await read.json()) as ColumnTemplate).columns).toEqual(written.columns)
  })

  it('refuse un fichier abime', async () => {
    expect((await ask('/api/templates/jsonl', 'POST', { jsonl: 'nawak' })).status).toBe(422)
  })

  it('refuse l import a qui n est pas admin', async () => {
    admin = false
    const exported = toJsonl({ id: 1, version: 1, ...SHIPPED_TEMPLATE })

    expect((await ask('/api/templates/jsonl', 'POST', { jsonl: exported })).status).toBe(403)
  })
})

describe('un projet adopte une version et y reste', () => {
  it('suit la version adoptee, pas la derniere ecrite', async () => {
    const adopted = (await (
      await ask('/api/templates', 'POST', {
        ...SHIPPED_TEMPLATE,
        slug: 'team',
        isDefault: false,
      })
    ).json()) as ColumnTemplate
    await ask(`/api/projects/${projectId}/template`, 'POST', { templateId: adopted.id })

    await ask('/api/templates', 'POST', {
      ...SHIPPED_TEMPLATE,
      slug: 'team',
      isDefault: false,
      columns: SHIPPED_TEMPLATE.columns.map((column) => ({ ...column, label: 'Autre' })),
    })

    const kept = (await (await ask(`/api/projects/${projectId}/template`)).json()) as ColumnTemplate

    expect(kept.id).toBe(adopted.id)
    expect(kept.columns[0]?.label).not.toBe('Autre')
  })

  it('refuse l adoption a qui n est pas admin', async () => {
    admin = false

    expect((await ask(`/api/projects/${projectId}/template`, 'POST', { templateId: 1 })).status).toBe(
      403,
    )
  })

  it('refuse un modele qui n existe pas', async () => {
    expect(
      (await ask(`/api/projects/${projectId}/template`, 'POST', { templateId: 404 })).status,
    ).toBe(404)
  })
})
