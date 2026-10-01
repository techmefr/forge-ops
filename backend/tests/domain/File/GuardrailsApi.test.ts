import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFileApi } from '../../../src/domain/File/FileApi.js'
import { createFileRepository } from '../../../src/domain/File/FileRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { installGuardrails } from '../../../src/technical/Guardrail/GuardrailInstall.js'

let db: Database.Database
let api: Hono
let checkout: string
let forgeRoot: string
let projectId: number
let administrator = true

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'guard-checkout-'))
  forgeRoot = mkdtempSync(join(tmpdir(), 'guard-forge-'))
  mkdirSync(join(forgeRoot, 'node_modules', '.bin'), { recursive: true })
  writeFileSync(join(forgeRoot, 'node_modules', '.bin', 'tsx'), '')
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db, { checkoutRoots: [tmpdir()] })
  projectId = stories.createProject({
    slug: 'demo',
    name: 'Demo',
    repositoryUrl: 'git@example.com:demo.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
    checkoutPath: checkout,
  }).id
  administrator = true
  api = createFileApi({
    stories,
    files: createFileRepository(db),
    checkoutRoots: [tmpdir()],
    mayAdminister: () => administrator,
    installGuardrails: (path) => installGuardrails({ checkout: path, forgeRoot, hook: { port: 8830, token: 'b'.repeat(64) } }),
  })
})

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true })
  rmSync(forgeRoot, { recursive: true, force: true })
})

describe('POST /api/projects/:id/guardrails', () => {
  it('writes the hooks into the project checkout', async () => {
    const answer = await api.request(`/api/projects/${projectId}/guardrails`, { method: 'POST' })

    expect(answer.status).toBe(200)
    expect(existsSync(join(checkout, '.claude', 'settings.json'))).toBe(true)
    expect(existsSync(join(checkout, '.claude', 'settings.local.json'))).toBe(true)
  })

  it('needs a project administrator', async () => {
    administrator = false

    const answer = await api.request(`/api/projects/${projectId}/guardrails`, { method: 'POST' })

    expect(answer.status).toBe(403)
    expect(existsSync(join(checkout, '.claude', 'settings.json'))).toBe(false)
  })

  it('answers 404 for an unknown project and 409 when no checkout is declared', async () => {
    expect((await api.request('/api/projects/999/guardrails', { method: 'POST' })).status).toBe(404)
    db.prepare('UPDATE project SET checkout_path = NULL WHERE id = ?').run(projectId)
    expect((await api.request(`/api/projects/${projectId}/guardrails`, { method: 'POST' })).status).toBe(409)
  })
})
