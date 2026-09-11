import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const TOKEN_BYTES = 32
const TOKEN_LENGTH = TOKEN_BYTES * 2

export class TokenUnreadableError extends Error {
  constructor(path: string, reason: string) {
    super(`le jeton du board est illisible dans ${path} : ${reason}`)
    this.name = 'TokenUnreadableError'
  }
}

const HOOK_PURPOSE = 'forge:hook-intake'

export function deriveHookToken(boardToken: string): string {
  return createHmac('sha256', boardToken).update(HOOK_PURPOSE).digest('hex')
}

export function resolveBoardToken(path: string): string {
  if (!existsSync(path)) {
    const token = randomBytes(TOKEN_BYTES).toString('hex')
    try {
      writeFileSync(path, `${token}\n`, { encoding: 'utf-8', mode: 0o600 })
    } catch (error) {
      throw new TokenUnreadableError(path, error instanceof Error ? error.message : String(error))
    }
    return token
  }

  let content: string
  try {
    content = readFileSync(path, 'utf-8')
  } catch (error) {
    throw new TokenUnreadableError(path, error instanceof Error ? error.message : String(error))
  }

  const token = content.trim()
  if (token.length < TOKEN_LENGTH) {
    throw new TokenUnreadableError(path, `un jeton fait ${TOKEN_LENGTH} caracteres, celui-ci en fait ${token.length}`)
  }
  return token
}

export type RotatedBoardToken = {
  token: string
  hookToken: string
}

export function rotateBoardToken(path: string): RotatedBoardToken {
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  const staging = `${path}.${randomBytes(6).toString('hex')}.rotating`
  try {
    writeFileSync(staging, `${token}\n`, { encoding: 'utf-8', mode: 0o600 })
    renameSync(staging, path)
  } catch (error) {
    rmSync(staging, { force: true })
    throw new TokenUnreadableError(path, error instanceof Error ? error.message : String(error))
  }
  return { token, hookToken: deriveHookToken(token) }
}
