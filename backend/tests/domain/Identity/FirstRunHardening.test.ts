import { chmodSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import { resolveExternalUser, ExternalIdentityRefusedError } from '../../../src/domain/Identity/ExternalIdentity.js'
import { writeSecretOnce } from '../../../src/technical/Setup/SetupFiles.js'
import { subjectLinkSchema } from '../../../../contract/EpicContract.js'
import { workflowColumnDraftSchema } from '../../../../contract/WorkflowColumnContract.js'
import type { OidcClaims } from '../../../src/technical/Auth/OidcProvider.js'

const PASSWORD = 'un mot de passe assez long'
const ENROLMENT = { login: 'first', displayName: 'First', password: PASSWORD, role: 'director' }

let identities: IdentityRepository

function apiWith(input: { allowEnrolment: boolean; setupToken?: string | null }): Hono {
  return createIdentityApi({ identities, allowEnrolment: () => input.allowEnrolment, setupToken: input.setupToken })
}

function send(api: Hono, method: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

function claims(overrides: Partial<OidcClaims>): OidcClaims {
  return { subject: 'microsoft:sub-1', email: 'ana@corp.example', isEmailVerified: false, displayName: 'Ana', ...overrides }
}

beforeEach(() => {
  identities = createIdentityRepository(openDatabase(':memory:'))
})

describe('first enrolment', () => {
  it('stays closed when enrolment is not allowed', async () => {
    const response = await send(apiWith({ allowEnrolment: false }), 'POST', '/api/auth/enrol', ENROLMENT)

    expect(response.status).toBe(403)
    expect(identities.countUsers()).toBe(0)
  })

  it('demands the setup token when one is configured', async () => {
    const api = apiWith({ allowEnrolment: true, setupToken: 'setup-secret' })

    const missing = await send(api, 'POST', '/api/auth/enrol', ENROLMENT)
    const wrong = await send(api, 'POST', '/api/auth/enrol', ENROLMENT, { 'x-forge-setup-token': 'nope' })
    const right = await send(api, 'POST', '/api/auth/enrol', ENROLMENT, { 'x-forge-setup-token': 'setup-secret' })

    expect([missing.status, wrong.status, right.status]).toEqual([403, 403, 201])
  })
})

describe('email ownership', () => {
  beforeEach(() => {
    identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' })
    identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
    identities.changeEmail('ana', 'ana@corp.example')
  })

  it('answers a taken address with a message that does not name it', async () => {
    const token = identities.openSession('bob', PASSWORD).token
    const response = await send(apiWith({ allowEnrolment: false }), 'PUT', '/api/auth/profile', { email: 'ana@corp.example' }, { 'x-forge-identity': token })
    const text = await response.text()

    expect(response.status).toBe(409)
    expect(text).not.toContain('ana@corp.example')
  })

  it('does not let an unverified address block the owner of the mailbox from signing in with SSO', () => {
    const user = resolveExternalUser(identities, claims({ isEmailVerified: true }), ['corp.example'])

    expect(user.login).not.toBe('ana')
    expect(identities.findUserByExternalSubject('microsoft:sub-1')?.login).toBe(user.login)
  })

  it('links a verified claim to the account whose address an admin verified', () => {
    identities.verifyEmail('ana')

    const user = resolveExternalUser(identities, claims({ isEmailVerified: true }), ['corp.example'])

    expect(user.login).toBe('ana')
  })

  it('refuses an unverified claim on an address another account holds', () => {
    expect(() => resolveExternalUser(identities, claims({}), ['corp.example'])).toThrow(ExternalIdentityRefusedError)
  })

  it('enrols a Microsoft claim without xms_edov with an unverified email', () => {
    const user = resolveExternalUser(identities, claims({ email: 'new@corp.example', subject: 'microsoft:sub-2' }), ['corp.example'])
    const row = identities.findVerifiedUserByEmail('new@corp.example')

    expect(user.email).toBe('new@corp.example')
    expect(row).toBeNull()
  })
})

describe('verifying an email', () => {
  beforeEach(() => {
    identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
    identities.enrolUser({ login: 'dir', displayName: 'Dir', password: PASSWORD, role: 'director' })
    identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' })
    identities.changeEmail('ana', 'ana@corp.example')
  })

  it('is allowed to a director and to a super admin', async () => {
    const api = apiWith({ allowEnrolment: false })
    const director = await send(api, 'POST', '/api/board-users/ana/verify-email', {}, { 'x-forge-identity': identities.openSession('dir', PASSWORD).token })

    expect(director.status).toBe(200)
    expect(identities.findVerifiedUserByEmail('ana@corp.example')?.login).toBe('ana')
  })

  it('refuses to verify an address a verified account already holds', () => {
    resolveExternalUser(identities, claims({ isEmailVerified: true }), ['corp.example'])

    expect(() => identities.verifyEmail('ana')).toThrow(/ne peut pas/)
  })

  it('is refused to an architect and to anonymous callers', async () => {
    const api = apiWith({ allowEnrolment: false })
    const architect = await send(api, 'POST', '/api/board-users/ana/verify-email', {}, { 'x-forge-identity': identities.openSession('ana', PASSWORD).token })
    const anonymous = await send(api, 'POST', '/api/board-users/ana/verify-email', {})

    expect([architect.status, anonymous.status]).toEqual([403, 401])
    expect(identities.findVerifiedUserByEmail('ana@corp.example')).toBeNull()
  })
})

describe('link credentials', () => {
  it.each(['https://user:pw@example.com/x', 'https://user@example.com/x'])('rejects %s', (url) => {
    expect(subjectLinkSchema.safeParse({ kind: 'doc', url }).success).toBe(false)
  })

  it('accepts a plain https address', () => {
    expect(subjectLinkSchema.safeParse({ kind: 'doc', url: 'https://example.com/x?y=1' }).success).toBe(true)
  })
})

describe('workflow references', () => {
  const column = {
    label: 'Spec',
    colour: '#7C3AED',
    provider: 'claude',
    model: '',
    effort: '',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: false,
  }

  it.each(['/speckit.specify', 'BUILD.md', 'speckit:plan', ''])('accepts the command %j', (command) => {
    expect(workflowColumnDraftSchema.safeParse({ ...column, command }).success).toBe(true)
  })

  it.each(['rm -rf /', '../../x', '/a b', 'a;b', '$(id)', '/a/b'])('rejects the command %j', (command) => {
    expect(workflowColumnDraftSchema.safeParse({ ...column, command }).success).toBe(false)
  })

  it.each(['architecte', 'team:elrond'])('accepts the agent %j', (agentName) => {
    expect(workflowColumnDraftSchema.safeParse({ ...column, agentName }).success).toBe(true)
  })

  it.each(['../evil', 'a b', 'x;y', '`id`'])('rejects the agent %j', (agentName) => {
    expect(workflowColumnDraftSchema.safeParse({ ...column, agentName }).success).toBe(false)
  })
})

describe('secrets directory', () => {
  let parent = ''

  beforeEach(() => {
    parent = mkdtempSync(join(tmpdir(), 'forge-secrets-'))
  })

  afterEach(() => {
    chmodSync(parent, 0o700)
    rmSync(parent, { recursive: true, force: true })
  })

  it.skipIf(process.platform === 'win32')('creates the directory with mode 0700', () => {
    const directory = join(parent, 'docker')

    writeSecretOnce(directory, 'board_token', 'value')

    expect(statSync(directory).mode & 0o777).toBe(0o700)
  })
})
