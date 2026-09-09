import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export type TokenGuardInput = {
  token: string
  allowedOrigins: readonly string[]
  queryTokenPaths: readonly string[]
}

function sameToken(offered: string, expected: string): boolean {
  const left = Buffer.from(offered)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

function headerToken(authorization: string | undefined, ownHeader: string | undefined): string | null {
  if (ownHeader !== undefined && ownHeader !== '') {
    return ownHeader
  }
  if (authorization === undefined) {
    return null
  }
  const [scheme, value] = authorization.split(' ')
  if (scheme !== 'Bearer' || value === undefined) {
    return null
  }
  return value
}

export function createTokenGuard({
  token,
  allowedOrigins,
  queryTokenPaths,
}: TokenGuardInput): MiddlewareHandler {
  return async (context, next) => {
    const origin = context.req.header('origin')
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      return context.json({ error: 'ForbiddenOrigin' }, 403)
    }

    const fromHeader = headerToken(context.req.header('authorization'), context.req.header('x-forge-token'))
    const offered =
      fromHeader ?? (queryTokenPaths.includes(context.req.path) ? (context.req.query('token') ?? null) : null)

    if (offered === null || !sameToken(offered, token)) {
      return context.json({ error: 'UnauthorizedBoardAccess' }, 401)
    }

    await next()
    return undefined
  }
}
