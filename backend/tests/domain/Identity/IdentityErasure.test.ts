import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { LastSuperAdminError } from '../../../src/domain/Identity/IdentityViolation.js'

const PASSWORD = 'un mot de passe assez long'

let db: Database.Database
let identities: IdentityRepository
let stories: StoryRepository
let api: Hono
let projectId: number
let epicId: number

function erase(login: string, as: string): Promise<Response> {
  const token = identities.openSession(as, PASSWORD).token
  return api.request(`/api/board-users/${login}/erase`, {
    method: 'POST',
    headers: { 'x-forge-identity': token },
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  stories = createStoryRepository(db)
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  identities.enrolUser({ login: 'ana', displayName: 'Ana Martin', password: PASSWORD, role: 'architect' })
  identities.enrolUser({ login: 'dir', displayName: 'Dir', password: PASSWORD, role: 'director' })
  identities.changeEmail('ana', 'ana@example.com')
  api = createIdentityApi({ identities, allowEnrolment: () => false })
  projectId = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  }).id
  epicId = stories.createEpic({ projectId, title: 'Sujet', businessIntent: 'x' }).id
})

describe('erasing an account', () => {
  it('drops the name, the email and the way in, and keeps the history under a pseudonym', async () => {
    const anaId = identities.findUser('ana')?.id ?? 0
    stories.assignEpic(epicId, 'ana')
    db.prepare("UPDATE epic SET requested_by = 'Ana Martin' WHERE id = ?").run(epicId)
    db.prepare("INSERT INTO project_decision (project_id, decided_on, text, decided_by) VALUES (?, '2026-09-01', 'Go', 'ana')").run(projectId)
    const session = identities.openSession('ana', PASSWORD).token

    const response = await erase('ana', 'root')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ login: `erased-${anaId}`, displayName: 'Former user', active: false })
    const row = db.prepare('SELECT email, external_subject FROM board_user WHERE id = ?').get(anaId)
    expect(row).toEqual({ email: null, external_subject: null })
    expect(identities.readSession(session)).toBeNull()
    expect(() => identities.openSession('ana', PASSWORD)).toThrow()
    expect(db.prepare('SELECT assignee, requested_by FROM epic WHERE id = ?').get(epicId)).toEqual({
      assignee: `erased-${anaId}`,
      requested_by: `erased-${anaId}`,
    })
    expect(db.prepare('SELECT decided_by FROM project_decision').get()).toEqual({ decided_by: `erased-${anaId}` })
    expect(JSON.stringify(db.prepare('SELECT * FROM board_user WHERE id = ?').get(anaId))).not.toContain('Ana')
  })

  it('releases the projects the account administered', async () => {
    const anaId = identities.findUser('ana')?.id ?? 0
    db.prepare('UPDATE project SET admin_user_id = ? WHERE id = ?').run(anaId, projectId)

    await erase('ana', 'root')

    expect(db.prepare('SELECT admin_user_id FROM project WHERE id = ?').get(projectId)).toEqual({ admin_user_id: null })
  })

  it('is reserved to super admins', async () => {
    expect((await erase('ana', 'dir')).status).toBe(403)
    expect(identities.findUser('ana')?.displayName).toBe('Ana Martin')
  })

  it('never erases the last active super admin', async () => {
    expect(() => identities.eraseUser('root')).toThrow(LastSuperAdminError)
    expect((await erase('root', 'root')).status).toBe(409)
  })

  it('answers 409 for an unknown account', async () => {
    expect((await erase('ghost', 'root')).status).toBe(409)
  })
})
