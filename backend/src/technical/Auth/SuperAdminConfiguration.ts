import { readFileSync } from 'node:fs'

export type SuperAdminConfiguration = {
  login: string
  password: string
}

export type SecretReader = (path: string) => string

const readUtf8: SecretReader = (path) => readFileSync(path, 'utf8')

export function readSuperAdminConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  readSecret: SecretReader = readUtf8,
): SuperAdminConfiguration | null {
  const login = env.FORGE_SUPER_ADMIN_LOGIN?.trim() ?? ''
  const file = env.FORGE_SUPER_ADMIN_PASSWORD_FILE ?? ''
  const password = file === '' ? (env.FORGE_SUPER_ADMIN_PASSWORD ?? '') : readSecret(file).replace(/\r?\n$/, '')
  if (login === '' || password === '') {
    return null
  }
  return { login, password }
}
