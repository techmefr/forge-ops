import { describe, expect, it } from 'vitest'
import {
  composeFileOf,
  envLinesOf,
  envValueOf,
  oidcSecretFilesOf,
  generatedSecretsOf,
  hasSuperAdmin,
  redirectUriOf,
  validateAnswers,
  type SetupAnswers,
} from '../../../src/domain/Setup/SetupPlan.js'

const TENANT = '11111111-2222-3333-4444-555555555555'

const VPS: SetupAnswers = {
  topology: 'vps',
  publicInstanceUrl: 'https://forge.acme.com/',
  serverUrl: '',
  superAdminLogin: 'root',
  repositories: '',
  allowedDomains: ['acme.com'],
  google: { clientId: 'gid', clientSecret: 'gsecret' },
  microsoft: { clientId: 'mid', clientSecret: 'msecret', tenant: TENANT },
}

describe('setup plan', () => {
  it('choisit le bon fichier compose et les secrets a generer', () => {
    expect(composeFileOf('vps')).toBe('compose.vps.yml')
    expect(generatedSecretsOf('laptop')).toEqual(['board_token'])
    expect(generatedSecretsOf('vps')).toContain('super_admin_password')
  })

  it('generates the super admin password for every topology that holds a hub', () => {
    for (const topology of ['vps', 'split', 'hosted'] as const) {
      expect(hasSuperAdmin(topology)).toBe(true)
      expect(generatedSecretsOf(topology)).toContain('super_admin_password')
    }
    expect(hasSuperAdmin('laptop')).toBe(false)
    expect(generatedSecretsOf('laptop')).not.toContain('super_admin_password')
  })

  it('writes the super admin login for split and hosted', () => {
    for (const topology of ['split', 'hosted'] as const) {
      const answers: SetupAnswers = {
        ...VPS,
        topology,
        serverUrl: 'https://board.acme.com/',
        publicInstanceUrl: '',
        allowedDomains: [],
        google: null,
        microsoft: null,
      }
      expect(envLinesOf(answers)).toEqual(['FORGE_SERVER_URL=https://board.acme.com', 'FORGE_SUPER_ADMIN_LOGIN=root'])
      expect(validateAnswers({ ...answers, superAdminLogin: 'Bad Login' })).toHaveLength(1)
    }
  })

  it('construit l adresse de retour a declarer chez le fournisseur', () => {
    expect(redirectUriOf('https://forge.acme.com/', 'google')).toBe(
      'https://forge.acme.com/api/auth/oidc/google/callback',
    )
  })

  it('ecrit les variables du vps avec OIDC', () => {
    expect(envLinesOf(VPS)).toEqual([
      'FORGE_PUBLIC_INSTANCE_URL=https://forge.acme.com',
      'FORGE_SUPER_ADMIN_LOGIN=root',
      'FORGE_OIDC_ALLOWED_DOMAINS=acme.com',
      'FORGE_OIDC_GOOGLE_CLIENT_ID=gid',
      'FORGE_OIDC_MICROSOFT_CLIENT_ID=mid',
      `FORGE_OIDC_MICROSOFT_TENANT=${TENANT}`,
    ])
  })

  it('accepte une config valide', () => {
    expect(validateAnswers(VPS)).toEqual([])
  })

  it('refuse un tenant Microsoft generique', () => {
    const answers = { ...VPS, microsoft: { clientId: 'm', clientSecret: 's', tenant: 'common' } }
    expect(validateAnswers(answers)).toHaveLength(1)
  })

  it('refuse OIDC hors topologie vps et une adresse invalide', () => {
    const answers: SetupAnswers = { ...VPS, topology: 'split', serverUrl: 'nope' }
    expect(validateAnswers(answers)).toHaveLength(2)
  })

  it('keeps client secrets out of the env lines and into secret files', () => {
    expect(envLinesOf(VPS).join('\n')).not.toContain('SECRET')
    expect(oidcSecretFilesOf(VPS)).toEqual([
      { name: 'oidc_google_client_secret', value: 'gsecret' },
      { name: 'oidc_microsoft_client_secret', value: 'msecret' },
    ])
    expect(oidcSecretFilesOf({ ...VPS, google: null, microsoft: null }).map((file) => file.value)).toEqual(['', ''])
    expect(oidcSecretFilesOf({ ...VPS, topology: 'laptop' })).toEqual([])
  })

  it('escapes values for compose', () => {
    expect(envValueOf('plain/path_1')).toBe('plain/path_1')
    expect(envValueOf('a$b')).toBe('"a$$b"')
    expect(envValueOf('say "hi" # x')).toBe('"say \\"hi\\" # x"')
    expect(() => envValueOf('a\nb')).toThrow()
  })
})
