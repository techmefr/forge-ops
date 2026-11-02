import type { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { cookieSecure } from '../../technical/Auth/SecureCookie.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../technical/Auth/PasswordHash.js'
import { clientAddressOf } from '../../technical/Auth/ClientAddress.js'
import type { LoginRateLimit } from '../../technical/Auth/LoginRateLimit.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import type { OpenedSession } from './Identity.js'
import type { IdentityApiInput } from './IdentityApi.js'
import { DESKTOP_CLIENT_HEADER, DESKTOP_CLIENT_VALUE, SETUP_TOKEN_HEADER, type CallerOf } from './IdentityApiSupport.js'

const credentialsSchema = z.object({
  login: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
})

const enrolmentSchema = z.object({
  login: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  displayName: z.string().min(1).max(120),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  role: z.enum(['director', 'architect']),
})

function matchesToken(expected: string, given: string | undefined): boolean {
  const wanted = Buffer.from(expected)
  const offered = Buffer.from(given ?? '')
  return wanted.length === offered.length && timingSafeEqual(wanted, offered)
}

type SessionRoutesInput = Pick<IdentityApiInput, 'identities' | 'allowEnrolment'> & {
  setupToken: string | null
  loginLimit: LoginRateLimit
  clientLimit: LoginRateLimit
  trustProxy: boolean
  callerOf: CallerOf
}

export function mountIdentitySessionRoutes(
  api: Hono,
  { identities, allowEnrolment, setupToken, loginLimit, clientLimit, trustProxy, callerOf }: SessionRoutesInput,
): void {
  api.post('/api/auth/login', async (context) => {
    const credentials = await parseBody(context, credentialsSchema)
    if (!credentials.success) {
      return context.json({ error: 'InvalidCredentials' }, 422)
    }
    const { login, password } = credentials.data
    const client = clientAddressOf(context, trustProxy)
    const clientKey = `client:${client}`
    const pairKey = `login:${login}|${client}`
    const waitMs = Math.max(clientLimit.retryAfterMs(clientKey), loginLimit.retryAfterMs(pairKey))
    if (clientLimit.refuses(clientKey) || loginLimit.refuses(pairKey)) {
      context.header('retry-after', String(Math.ceil(waitMs / 1000)))
      return context.json({ error: 'TooManyLoginAttempts' }, 429)
    }
    let opened: OpenedSession
    try {
      opened = identities.openSession(login, password)
    } catch (error) {
      clientLimit.recordFailure(clientKey)
      loginLimit.recordFailure(pairKey)
      throw error
    }
    loginLimit.forget(pairKey)
    setCookie(context, IDENTITY_COOKIE, opened.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: cookieSecure(context),
      expires: new Date(opened.expiresAt),
    })
    const isDesktopClient = context.req.header(DESKTOP_CLIENT_HEADER) === DESKTOP_CLIENT_VALUE
    return context.json(isDesktopClient ? { user: opened.user, token: opened.token } : { user: opened.user })
  })

  api.post('/api/auth/logout', (context) => {
    const token = context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE)
    if (token !== undefined && token !== '') {
      identities.closeSession(token)
    }
    deleteCookie(context, IDENTITY_COOKIE, { path: '/' })
    return context.json({ closed: true })
  })

  api.post('/api/auth/enrol', async (context) => {
    if (!allowEnrolment()) {
      return context.json({ error: 'EnrolmentClosed' }, 403)
    }
    if (setupToken !== null && !matchesToken(setupToken, context.req.header(SETUP_TOKEN_HEADER))) {
      return context.json({ error: 'SetupTokenRequired' }, 403)
    }
    const draft = await parseBody(context, enrolmentSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidEnrolment', issues: draft.error.issues }, 422)
    }
    return context.json(identities.enrolUser(draft.data), 201)
  })

  api.get('/api/auth/me', (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    return context.json(user)
  })

  api.get('/api/auth/state', (context) =>
    context.json({ users: identities.countUsers(), enrolmentOpen: allowEnrolment() }),
  )
}
