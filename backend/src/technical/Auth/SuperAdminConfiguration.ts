import { readFileSync } from 'node:fs'

export type SuperAdminConfiguration = {
  login: string
  password: string
}

export type SecretReader = (path: string) => string

export type Warner = (message: string) => void

const readUtf8: SecretReader = (path) => readFileSync(path, 'utf8')

function passwordOf(
  env: NodeJS.ProcessEnv,
  readSecret: SecretReader,
  warn: Warner,
): string {
  const file = env.FORGE_SUPER_ADMIN_PASSWORD_FILE ?? ''
  if (file === '') {
    return env.FORGE_SUPER_ADMIN_PASSWORD ?? ''
  }
  try {
    return readSecret(file).replace(/\r?\n$/, '')
  } catch {
    warn(`FORGE_SUPER_ADMIN_PASSWORD_FILE points to ${file}, which cannot be read: no super admin is configured.`)
    return ''
  }
}

export function readSuperAdminConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  readSecret: SecretReader = readUtf8,
  warn: Warner = () => undefined,
): SuperAdminConfiguration | null {
  const login = env.FORGE_SUPER_ADMIN_LOGIN?.trim() ?? ''
  const password = passwordOf(env, readSecret, warn)
  if (login === '' || password === '') {
    return null
  }
  return { login, password }
}
