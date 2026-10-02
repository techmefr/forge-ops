import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
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
let db: Database.Database
let root = ''
let projectId = 0
let blindProjectId = 0

function seed(db: Database.Database): void {
  const stories = createStoryRepository(db, { checkoutRoots: [tmpdir()] })
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

let mayAdminister = true

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'forge-api-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'UserModal.vue'), '<template />\n')
  writeFileSync(join(root, 'src', 'UserModale.vue'), '<template />\n')
  db = openDatabase(':memory:')
  seed(db)
  api = createFileApi({
    stories: createStoryRepository(db, { checkoutRoots: [tmpdir()] }),
    files: createFileRepository(db),
    checkoutRoots: [tmpdir()],
    mayAdminister: () => mayAdminister,
  })
  mayAdminister = true
})

describe('GET /api/projects/:id/tree', () => {
  it('rend les entrees du dossier avec leur description et leur marque', async () => {
    const answer = await api.request(`/api/projects/${projectId}/tree?path=src`)
    expect(answer.status).toBe(200)
    const body = (await answer.json()) as {
      entries: readonly {
        path: string
        mark: string
        agentName: string | null
        description: unknown
      }[]
    }
    expect(body.entries.map((entry) => [entry.path, entry.mark])).toEqual([
      ['src/Disparu.vue', 'created'],
      ['src/UserModal.vue', 'planned'],
      ['src/UserModale.vue', 'quiet'],
    ])
    expect(body.entries[1]?.agentName).toBe('neo')
    expect(body.entries[1]?.description).toEqual({ key: 'component', values: { name: 'UserModal' } })
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
  it('does not leak an absolute server path when the file cannot be read', async () => {
    const answer = await api.request(`/api/projects/${projectId}/file?path=src/missing.txt`)
    const text = await answer.text()

    expect(answer.status).toBe(404)
    expect(text).not.toMatch(/realpath|\/home\/|\/tmp\//)
    expect(JSON.parse(text)).toMatchObject({ error: 'FileUnreadable' })
  })

  it('rend le contenu du fichier et qui le tient', async () => {
    const answer = await api.request(`/api/projects/${projectId}/file?path=src/UserModal.vue`)
    expect(answer.status).toBe(200)
    const body = (await answer.json()) as { highlightedHtml: string; highlightAvailable: boolean }
    expect(body).toMatchObject({
      path: 'src/UserModal.vue',
      text: '<template />\n',
      bytes: 13,
      truncated: false,
      description: { key: 'component', values: { name: 'UserModal' } },
      mark: 'planned',
      byReferences: ['FORGE-1'],
      agentName: 'neo',
      highlightAvailable: true,
    })
    expect(body.highlightedHtml).toContain('<pre')
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
  it('is refused to anyone who does not administer the project', async () => {
    mayAdminister = false

    const answer = await pointing(blindProjectId, root)

    expect(answer.status).toBe(403)
    expect(await answer.json()).toEqual({ error: 'CheckoutNeedsAnAdmin' })
  })

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

describe("a checkout path slipped straight into the database", () => {
  it("refuses to list a tree under it", async () => {
    db.prepare("UPDATE project SET checkout_path = ? WHERE id = ?").run("/", projectId)
    const answer = await api.request("/api/projects/" + projectId + "/tree")
    expect(answer.status).toBe(422)
    expect((await answer.json()) as { error: string }).toMatchObject({ error: "CheckoutPathRefused" })
  })

  it("refuses to read a file under it", async () => {
    db.prepare("UPDATE project SET checkout_path = ? WHERE id = ?").run("/", projectId)
    const answer = await api.request("/api/projects/" + projectId + "/file?path=etc/hostname")
    expect(answer.status).toBe(422)
  })

  it("refuses to walk it for clashes", async () => {
    db.prepare("UPDATE project SET checkout_path = ? WHERE id = ?").run("/", projectId)
    const answer = await api.request("/api/projects/" + projectId + "/clashes")
    expect(answer.status).toBe(422)
  })

  it("says why it was refused", async () => {
    db.prepare("UPDATE project SET checkout_path = ? WHERE id = ?").run("/", projectId)
    const answer = await api.request("/api/projects/" + projectId + "/tree")
    expect(((await answer.json()) as { reason: string }).reason).toContain("racines autorisees")
  })
})

describe('secret and server data protection', () => {
  it('never lists or serves dotenv, key, token or database files', async () => {
    writeFileSync(join(root, '.env'), 'SECRET=1')
    writeFileSync(join(root, '.env.production'), 'SECRET=2')
    writeFileSync(join(root, 'server.pem'), 'pem')
    writeFileSync(join(root, 'deploy.key'), 'key')
    writeFileSync(join(root, '.forge-token'), 'tok')
    writeFileSync(join(root, 'forge.db'), 'SQLite format 3')
    writeFileSync(join(root, 'forge.db-wal'), 'wal')
    mkdirSync(join(root, '.claude'), { recursive: true })
    writeFileSync(join(root, '.claude', 'settings.local.json'), '{}')
    mkdirSync(join(root, '.ssh'), { recursive: true })
    writeFileSync(join(root, '.ssh', 'config'), 'x')

    const listed = (await (await api.request(`/api/projects/${projectId}/tree?path=`)).json()) as {
      entries: readonly { name: string }[]
    }
    expect(listed.entries.map((entry) => entry.name)).toEqual(['.claude', 'src'])
    const claude = (await (await api.request(`/api/projects/${projectId}/tree?path=.claude`)).json()) as {
      entries: readonly { name: string }[]
    }
    expect(claude.entries).toEqual([])

    for (const path of [
      '.env',
      '.env.production',
      'server.pem',
      'deploy.key',
      '.forge-token',
      'forge.db',
      'forge.db-wal',
      '.claude/settings.local.json',
      '.ssh/config',
    ]) {
      const answer = await api.request(`/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`)
      expect(answer.status, path).toBe(403)
      expect(await answer.text()).not.toMatch(/SECRET|SQLite|tok/)
    }
  })

  it('refuses a symlink that leads to a secret', async () => {
    writeFileSync(join(root, '.env'), 'SECRET=1')
    symlinkSync(join(root, '.env'), join(root, 'innocent.txt'))
    const answer = await api.request(`/api/projects/${projectId}/file?path=innocent.txt`)
    expect(answer.status).toBe(403)
  })

  it('refuses a checkout that contains the server data', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'forge-data-'))
    writeFileSync(join(dataDir, 'forge.db'), 'SQLite format 3')
    const guarded = createFileApi({
      stories: createStoryRepository(db, { checkoutRoots: [tmpdir()] }),
      files: createFileRepository(db),
      checkoutRoots: [tmpdir()],
      serverPaths: [join(dataDir, 'forge.db'), join(dataDir, '.forge-token')],
      mayAdminister: () => true,
    })
    const repository = createStoryRepository(db, { checkoutRoots: [tmpdir()] })
    repository.setCheckoutPath(projectId, dataDir)

    const tree = await guarded.request(`/api/projects/${projectId}/tree?path=`)
    expect(tree.status).toBe(422)
    expect(await tree.json()).toMatchObject({ error: 'CheckoutPathRefused' })
    const file = await guarded.request(`/api/projects/${projectId}/file?path=forge.db`)
    expect(file.status).toBe(422)

    const put = await guarded.request(`/api/projects/${projectId}/checkout`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: dataDir }),
    })
    expect(put.status).toBe(422)
  })
})
