import { timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

export const BOARD_COOKIE = 'forge_token'
export const HOOK_INTAKE_PATH = '/api/hooks'

export const IDENTITY_COOKIE = 'forge_identity'

export const SESSION_EXCHANGE_PATH = '/api/auth/session'

export const LOCAL_SESSION_PATH = '/api/auth/session/local'

export const BOARD_MODE_PATH = '/api/board/mode'

export const OPEN_PATHS: readonly string[] = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/enrol',
  '/api/auth/state',
]

export const OIDC_PATH_PREFIX = '/api/auth/oidc/'

function isOpenPath(path: string): boolean {
  return OPEN_PATHS.includes(path) || path.startsWith(OIDC_PATH_PREFIX)
}

export type TokenGuardInput = {
  token: string
  hookToken: string
  allowedOrigins: readonly string[]
  requireIdentity?: boolean
  readIdentity?: (sessionToken: string) => { login: string } | null
  readBrowserSession?: (sessionToken: string) => boolean
  allowSessionExchange?: boolean
  allowLocalAutologin?: boolean
  isLocalOrigin?: (origin: string | undefined) => boolean
  isLoopbackPeer?: (context: Context) => boolean
}

export function sameSecret(offered: string, expected: string): boolean {
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

function isUnguardedPath(context: Context, input: TokenGuardInput, origin: string | undefined): boolean {
  const { path } = context.req
  if (path === BOARD_MODE_PATH) {
    return true
  }
  if (input.allowSessionExchange === true && path === SESSION_EXCHANGE_PATH) {
    return true
  }
  return (
    input.allowLocalAutologin === true &&
    path === LOCAL_SESSION_PATH &&
    (input.isLocalOrigin?.(origin) ?? false) &&
    (origin !== undefined || (input.isLoopbackPeer?.(context) ?? false))
  )
}

function identityRejection(context: Context, input: TokenGuardInput): Response | null {
  if (isOpenPath(context.req.path)) {
    return null
  }
  const sessionToken = context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE) ?? null
  const identity = sessionToken === null ? null : (input.readIdentity?.(sessionToken) ?? null)
  if (identity === null) {
    return context.json({ error: 'UnauthenticatedBoardAccess' }, 401)
  }
  context.set('login', identity.login)
  return null
}

function boardRejection(context: Context, input: TokenGuardInput, fromHeader: string | null): Response | null {
  if (fromHeader !== null) {
    return sameSecret(fromHeader, input.token) ? null : context.json({ error: 'UnauthorizedBoardAccess' }, 401)
  }
  const fromCookie = getCookie(context, BOARD_COOKIE) ?? null
  if (fromCookie === null || input.readBrowserSession?.(fromCookie) !== true) {
    return context.json({ error: 'UnauthorizedBoardAccess' }, 401)
  }
  return null
}

function rejectionFor(context: Context, input: TokenGuardInput): Response | null {
  const origin = context.req.header('origin')
  if (origin !== undefined && !input.allowedOrigins.includes(origin)) {
    return context.json({ error: 'ForbiddenOrigin' }, 403)
  }
  if (isUnguardedPath(context, input, origin)) {
    return null
  }
  const fromHeader = headerSecret(context.req.header('authorization'), context.req.header('x-forge-token'))
  if (context.req.path === HOOK_INTAKE_PATH) {
    return fromHeader === null || !sameSecret(fromHeader, input.hookToken)
      ? context.json({ error: 'UnauthorizedHookIntake' }, 401)
      : null
  }
  if (input.requireIdentity === true) {
    return identityRejection(context, input)
  }
  return boardRejection(context, input, fromHeader)
}

export function createTokenGuard(input: TokenGuardInput): MiddlewareHandler {
  return async (context, next) => {
    const rejection = rejectionFor(context, input)
    if (rejection !== null) {
      return rejection
    }
    await next()
    return undefined
  }
}
