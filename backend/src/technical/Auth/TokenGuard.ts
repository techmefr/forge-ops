import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

const STREAM_PATH = '/api/events'

export type TokenGuardInput = {
  token: string
  allowedOrigins: readonly string[]
  openPaths: readonly string[]
}

function sameToken(offered: string, expected: string): boolean {
  const left = Buffer.from(offered)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

function offeredToken(header: string | undefined, ownHeader: string | undefined): string | null {
  if (ownHeader !== undefined && ownHeader !== '') {
    return ownHeader
  }
  if (header === undefined) {
    return null
  }
  const [scheme, value] = header.split(' ')
  if (scheme !== 'Bearer' || value === undefined) {
    return null
  }
  return value
}

export function createTokenGuard({
  token,
  allowedOrigins,
  openPaths,
}: TokenGuardInput): MiddlewareHandler {
  return async (context, next) => {
    const origin = context.req.header('origin')
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      return context.json({ error: 'ForbiddenOrigin' }, 403)
    }

    if (openPaths.includes(context.req.path)) {
      await next()
      return undefined
    }

    const offered =
      context.req.path === STREAM_PATH
        ? (context.req.query('token') ??
          offeredToken(context.req.header('authorization'), context.req.header('x-forge-token')))
        : offeredToken(context.req.header('authorization'), context.req.header('x-forge-token'))

    if (offered === null || !sameToken(offered, token)) {
      return context.json({ error: 'UnauthorizedBoardAccess' }, 401)
    }

    await next()
    return undefined
  }
}
