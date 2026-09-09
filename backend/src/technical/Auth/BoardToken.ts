import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const TOKEN_BYTES = 32
const TOKEN_LENGTH = TOKEN_BYTES * 2

export class TokenUnreadableError extends Error {
  constructor(path: string, reason: string) {
    super(`le jeton du board est illisible dans ${path} : ${reason}`)
    this.name = 'TokenUnreadableError'
  }
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
