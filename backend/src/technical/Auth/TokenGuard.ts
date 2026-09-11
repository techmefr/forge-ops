import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

export const BOARD_COOKIE = 'forge_token'
export const HOOK_INTAKE_PATH = '/api/hooks'

export const IDENTITY_COOKIE = 'forge_identity'

export const OPEN_PATHS: readonly string[] = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/enrol',
  '/api/auth/state',
]

export type TokenGuardInput = {
  token: string
  hookToken: string
  allowedOrigins: readonly string[]
  requireIdentity?: boolean
  readIdentity?: (sessionToken: string) => { login: string } | null
}

function sameSecret(offered: string, expected: string): boolean {
  const left = Buffer.from(offered)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

function headerSecret(authorization: string | undefined, ownHeader: string | undefined): string | null {
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
  hookToken,
  allowedOrigins,
  requireIdentity = false,
  readIdentity,
}: TokenGuardInput): MiddlewareHandler {
  return async (context, next) => {
    const origin = context.req.header('origin')
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      return context.json({ error: 'ForbiddenOrigin' }, 403)
    }

    const fromHeader = headerSecret(context.req.header('authorization'), context.req.header('x-forge-token'))

    if (context.req.path === HOOK_INTAKE_PATH) {
      if (fromHeader === null || !sameSecret(fromHeader, hookToken)) {
        return context.json({ error: 'UnauthorizedHookIntake' }, 401)
      }
      await next()
      return undefined
    }

    if (requireIdentity) {
      if (OPEN_PATHS.includes(context.req.path)) {
        await next()
        return undefined
      }
      const sessionToken =
        context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE) ?? null
      const identity = sessionToken === null ? null : (readIdentity?.(sessionToken) ?? null)
      if (identity === null) {
        return context.json({ error: 'UnauthenticatedBoardAccess' }, 401)
      }
      context.set('login', identity.login)
      await next()
      return undefined
    }

    const offered = fromHeader ?? getCookie(context, BOARD_COOKIE) ?? null
    if (offered === null || !sameSecret(offered, token)) {
      return context.json({ error: 'UnauthorizedBoardAccess' }, 401)
    }

    await next()
    return undefined
  }
}
