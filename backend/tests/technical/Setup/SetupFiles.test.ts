import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newSecret, writeEnvFile, writeSecretOnce } from '../../../src/technical/Setup/SetupFiles.js'

const isPosix = process.platform !== 'win32'

describe('setup files', () => {
  let directory = ''

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'forge-setup-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('generates distinct url safe secrets', () => {
    expect(newSecret()).not.toBe(newSecret())
    expect(newSecret()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it.skipIf(!isPosix)('writes a secret with mode 0600 and never overwrites it', () => {
    expect(writeSecretOnce(directory, 'board_token', 'first')).toBe(true)
    expect(writeSecretOnce(directory, 'board_token', 'second')).toBe(false)
    expect(readFileSync(join(directory, 'board_token.secret'), 'utf8')).toBe('first')
    expect(statSync(join(directory, 'board_token.secret')).mode & 0o777).toBe(0o600)
  })

  it('fills a secret left empty by an earlier run', () => {
    expect(writeSecretOnce(directory, 'oidc', '')).toBe(true)
    expect(writeSecretOnce(directory, 'oidc', 'real')).toBe(true)
    expect(readFileSync(join(directory, 'oidc.secret'), 'utf8')).toBe('real')
  })

  it.skipIf(!isPosix)('creates the env file with mode 0600', () => {
    writeEnvFile(directory, ['A=1'])
    expect(readFileSync(join(directory, '.env'), 'utf8')).toBe('A=1\n')
    expect(statSync(join(directory, '.env')).mode & 0o777).toBe(0o600)
  })

  it('keeps unrelated lines of an existing env file and replaces matching keys', () => {
    writeFileSync(join(directory, '.env'), '# mine\nKEEP=yes\nA=old\n')
    writeEnvFile(directory, ['A=new', 'B=2'])
    expect(readFileSync(join(directory, '.env'), 'utf8')).toBe('# mine\nKEEP=yes\nA=new\nB=2\n')
  })

  it('backs up the previous env file', () => {
    writeFileSync(join(directory, '.env'), 'A=old\n')
    writeEnvFile(directory, ['A=new'])
    expect(readFileSync(join(directory, '.env.bak'), 'utf8')).toBe('A=old\n')
  })

  it.skipIf(!isPosix)('tightens a wider mode on an existing env file and its backup', () => {
    writeFileSync(join(directory, '.env'), 'A=old\n')
    chmodSync(join(directory, '.env'), 0o644)
    writeEnvFile(directory, ['A=new'])
    expect(statSync(join(directory, '.env')).mode & 0o777).toBe(0o600)
    expect(statSync(join(directory, '.env.bak')).mode & 0o777).toBe(0o600)
  })

  it('keeps values with special characters as given', () => {
    writeEnvFile(directory, ['A="p$$ss"'])
    expect(readFileSync(join(directory, '.env'), 'utf8')).toBe('A="p$$ss"\n')
  })
})
