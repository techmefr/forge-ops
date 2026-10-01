import { describe, expect, it } from 'vitest'
import { readSuperAdminConfiguration } from '../../../src/technical/Auth/SuperAdminConfiguration.js'

describe('readSuperAdminConfiguration', () => {
  it('lit le login et le mot de passe de l environnement', () => {
    const configuration = readSuperAdminConfiguration(
      { FORGE_SUPER_ADMIN_LOGIN: 'root', FORGE_SUPER_ADMIN_PASSWORD: 'un mot de passe assez long' },
      () => '',
    )

    expect(configuration).toEqual({ login: 'root', password: 'un mot de passe assez long' })
  })

  it('lit le mot de passe d un fichier monte et retire le retour a la ligne', () => {
    const configuration = readSuperAdminConfiguration(
      { FORGE_SUPER_ADMIN_LOGIN: 'root', FORGE_SUPER_ADMIN_PASSWORD_FILE: '/run/secrets/super_admin' },
      (path) => (path === '/run/secrets/super_admin' ? 'depuis le fichier\n' : ''),
    )

    expect(configuration).toEqual({ login: 'root', password: 'depuis le fichier' })
  })

  it('prefere le fichier a la variable directe', () => {
    const configuration = readSuperAdminConfiguration(
      {
        FORGE_SUPER_ADMIN_LOGIN: 'root',
        FORGE_SUPER_ADMIN_PASSWORD: 'direct',
        FORGE_SUPER_ADMIN_PASSWORD_FILE: '/run/secrets/super_admin',
      },
      () => 'depuis le fichier',
    )

    expect(configuration?.password).toBe('depuis le fichier')
  })

  it('rend null sans login', () => {
    expect(readSuperAdminConfiguration({ FORGE_SUPER_ADMIN_PASSWORD: 'x' }, () => '')).toBeNull()
  })

  it('rend null sans mot de passe', () => {
    expect(readSuperAdminConfiguration({ FORGE_SUPER_ADMIN_LOGIN: 'root' }, () => '')).toBeNull()
  })

  it('rend null quand le fichier est vide', () => {
    const configuration = readSuperAdminConfiguration(
      { FORGE_SUPER_ADMIN_LOGIN: 'root', FORGE_SUPER_ADMIN_PASSWORD_FILE: '/run/secrets/super_admin' },
      () => '\n',
    )

    expect(configuration).toBeNull()
  })

  it('warns and carries on when the password file cannot be read', () => {
    const warnings: string[] = []

    const configuration = readSuperAdminConfiguration(
      { FORGE_SUPER_ADMIN_LOGIN: 'root', FORGE_SUPER_ADMIN_PASSWORD_FILE: '/run/secrets/missing' },
      () => {
        throw new Error('ENOENT')
      },
      (message) => warnings.push(message),
    )

    expect(configuration).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('/run/secrets/missing')
  })
})
