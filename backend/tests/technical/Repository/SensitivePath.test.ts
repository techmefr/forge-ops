import { describe, expect, it } from 'vitest'
import { isSensitivePath, isSensitiveSegments } from '../../../src/technical/Repository/SensitivePath.js'

describe('isSensitivePath', () => {
  it.each([
    '.env',
    '.env.production',
    'config/.ENV.local',
    'certs/server.pem',
    'keys/signing.key',
    'id_rsa',
    'id_ed25519.pub',
    '.forge-token',
    '.forge-token.rotated',
    'data/forge.db',
    'data/forge.db-wal',
    'store.sqlite3',
    '.npmrc',
    '.git-credentials',
    'credentials.json',
    '.ssh/config',
    'home/.aws/credentials',
    'a\\b\\.gnupg\\pubring.kbx',
    '.claude/settings.local.json',
  ])('flags %s', (path) => {
    expect(isSensitivePath(path)).toBe(true)
  })

  it.each([
    'README.md',
    'src/env.ts',
    'src/environment.ts',
    '.envrc.md',
    'docs/keyboard.md',
    '.claude/settings.json',
    'settings.local.json',
    'dbs/schema.sql',
    'credentials-guide.md',
  ])('lets %s through', (path) => {
    expect(isSensitivePath(path)).toBe(false)
  })
})

describe('isSensitiveSegments', () => {
  it('ignores empty and current-directory segments', () => {
    expect(isSensitiveSegments(['', '.', 'src', 'index.ts'])).toBe(false)
  })

  it('flags a sensitive directory anywhere in the chain', () => {
    expect(isSensitiveSegments(['project', '.kube', 'config'])).toBe(true)
  })
})
