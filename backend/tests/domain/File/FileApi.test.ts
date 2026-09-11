import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createFileApi } from '../../../src/domain/File/FileApi.js'
import { createFileRepository } from '../../../src/domain/File/FileRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import type { Hono } from 'hono'

let api: Hono
let root = ''
let projectId = 0
let blindProjectId = 0

function seed(db: Database.Database): void {
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
    checkoutPath: root,
  })
  projectId = project.id
  const blind = stories.createProject({
    slug: 'mailer',
    name: 'Mailer',
    repositoryUrl: 'git@example.com:mailer.git',
    integrationBranch: 'main',
    colour: '#d6ff2b',
  })
  blindProjectId = blind.id
  const epic = stories.createEpic({ projectId, title: 'User', businessIntent: 'besoin' })
  const story = stories.writeStory({ epicId: epic.id, title: 'porter le modal', body: 'corps' })
  stories.moveToState(story.id, 'building')
  sessions.registerSession({
    storyId: story.id,
    claudeSessionId: 'session-1',
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.224',
  })
  sessions.recordFileTouch({ claudeSessionId: 'session-1', path: 'src/UserModal.vue' })
  sessions.recordFileTouch({ claudeSessionId: 'session-1', path: 'src/Disparu.vue' })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'forge-api-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'UserModal.vue'), '<template />\n')
  writeFileSync(join(root, 'src', 'UserModale.vue'), '<template />\n')
  const db = openDatabase(':memory:')
  seed(db)
  api = createFileApi({ stories: createStoryRepository(db), files: createFileRepository(db) })
})

describe('GET /api/projects/:id/tree', () => {
  it('rend les entrees du dossier avec leur description et leur marque', async () => {
    const answer = await api.request(`/api/projects/${projectId}/tree?path=src`)
    expect(answer.status).toBe(200)
    const body = (await answer.json()) as {
      entries: readonly { path: string; mark: string; said: string; description: string }[]
    }
    expect(body.entries.map((entry) => [entry.path, entry.mark])).toEqual([
      ['src/Disparu.vue', 'created'],
      ['src/UserModal.vue', 'planned'],
      ['src/UserModale.vue', 'quiet'],
    ])
    expect(body.entries[1]?.said).toBe('FORGE-1 le modifie, session neo')
    expect(body.entries[1]?.description).toBe('Composant UserModal')
  })

  it('avoue quand le projet n a pas de copie locale', async () => {
    const answer = await api.request(`/api/projects/${blindProjectId}/tree`)
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ available: false, reason: 'CheckoutUnknown', entries: [] })
  })

  it('refuse un chemin qui sort du depot', async () => {
    const answer = await api.request(`/api/projects/${projectId}/tree?path=../../etc`)
    expect(answer.status).toBe(422)
    expect(await answer.json()).toEqual({ error: 'PathOutsideCheckout' })
  })

  it('refuse un projet inconnu', async () => {
    const answer = await api.request('/api/projects/9999/tree')
    expect(answer.status).toBe(404)
  })
})

describe('GET /api/projects/:id/file', () => {
  it('rend le contenu du fichier et qui le tient', async () => {
    const answer = await api.request(`/api/projects/${projectId}/file?path=src/UserModal.vue`)
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({
      path: 'src/UserModal.vue',
      text: '<template />\n',
      bytes: 13,
      truncated: false,
      description: 'Composant UserModal',
      mark: 'planned',
      said: 'FORGE-1 le modifie, session neo',
      byReferences: ['FORGE-1'],
    })
  })

  it('refuse de sortir du depot', async () => {
    const answer = await api.request(`/api/projects/${projectId}/file?path=../../etc/passwd`)
    expect(answer.status).toBe(422)
  })
})

describe('GET /api/projects/:id/clashes', () => {
  it('signale deux fichiers au nom trop proche', async () => {
    const answer = await api.request(`/api/projects/${projectId}/clashes`)
    expect(answer.status).toBe(200)
    const body = (await answer.json()) as { clashes: readonly { paths: readonly string[] }[] }
    expect(body.clashes.map((clash) => clash.paths)).toEqual([
      ['src/UserModal.vue', 'src/UserModale.vue'],
    ])
  })
})

async function pointing(projectId: number, checkoutPath: string): Promise<Response> {
  return api.request(`/api/projects/${projectId}/checkout`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ checkoutPath }),
  })
}

describe('PUT /api/projects/:id/checkout', () => {
  it('pointe le projet vers sa copie locale', async () => {
    const answer = await pointing(blindProjectId, root)
    expect(answer.status).toBe(200)
    const tree = await api.request(`/api/projects/${blindProjectId}/tree`)
    expect((await tree.json()) as { available: boolean }).toMatchObject({ available: true })
  })

  it('refuse un chemin vide', async () => {
    const answer = await pointing(blindProjectId, '')
    expect(answer.status).toBe(422)
  })

  it('refuse un dossier qui n existe pas', async () => {
    const answer = await pointing(blindProjectId, `${root}/nulle-part`)
    expect(answer.status).toBe(422)
    expect(await answer.json()).toEqual({ error: 'CheckoutNotADirectory' })
  })
})
