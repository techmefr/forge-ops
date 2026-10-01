import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  boardUserChangeSchema,
  boardUserDraftSchema,
  type BoardUserSheet,
} from '../../../../contract/ProjectContract.js'
import type { IdentityRepository } from './IdentityRepository.js'
import type { BoardUser, OpenedSession } from './Identity.js'
import {
  IdentityViolationError,
  LoginRefusedError,
  PasswordRefusedError,
  UnknownAccountError,
} from './IdentityViolation.js'

import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { cookieSecure } from '../../technical/Auth/SecureCookie.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordUnhashableError,
} from '../../technical/Auth/PasswordHash.js'
import { clientAddressOf, trustProxyFromEnv } from '../../technical/Auth/ClientAddress.js'
import { createLoginRateLimit, type LoginRateLimit } from '../../technical/Auth/LoginRateLimit.js'

export { IDENTITY_COOKIE }

export const SETUP_TOKEN_HEADER = 'x-forge-setup-token'
export const DESKTOP_CLIENT_HEADER = 'x-forge-client'
export const DESKTOP_CLIENT_VALUE = 'desktop'

const CLIENT_ATTEMPT_CAP = 30

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

const profileSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().max(200).optional(),
  })
  .refine((draft) => draft.displayName !== undefined || draft.email !== undefined)

function sheetOf(user: BoardUser): BoardUserSheet {
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    role: user.role,
    superAdmin: user.superAdmin,
    active: user.active,
    capacity: user.capacity,
  }
}

const passwordChangeSchema = z.object({
  current: z.string().min(1).max(256),
  next: z.string().min(1).max(256),
})

export type IdentityApiInput = {
  identities: IdentityRepository
  allowEnrolment: () => boolean
  setupToken?: string | null
  loginLimit?: LoginRateLimit
  clientLimit?: LoginRateLimit
  trustProxy?: boolean
}

function matchesToken(expected: string, given: string | undefined): boolean {
  const wanted = Buffer.from(expected)
  const offered = Buffer.from(given ?? '')
  return wanted.length === offered.length && timingSafeEqual(wanted, offered)
}

export function createIdentityApi({
  identities,
  allowEnrolment,
  setupToken = null,
  loginLimit = createLoginRateLimit(),
  clientLimit = createLoginRateLimit({ attemptCap: CLIENT_ATTEMPT_CAP }),
  trustProxy = trustProxyFromEnv(),
}: IdentityApiInput): Hono {
  const api = new Hono()

  function caller(sessionToken: string | undefined) {
    return sessionToken === undefined || sessionToken === ''
      ? null
      : identities.readSession(sessionToken)
  }

  api.onError((error, context) => {
    if (error instanceof LoginRefusedError) {
      return context.json({ error: error.name, message: error.message }, 401)
    }
    if (error instanceof PasswordUnhashableError || error instanceof PasswordRefusedError) {
      return context.json({ error: error.name, message: error.message }, 422)
    }
    if (error instanceof IdentityViolationError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.post('/api/auth/login', async (context) => {
    const credentials = credentialsSchema.safeParse(await context.req.json().catch(() => null))
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
    const draft = enrolmentSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidEnrolment', issues: draft.error.issues }, 422)
    }
    return context.json(identities.enrolUser(draft.data), 201)
  })

  api.get('/api/auth/me', (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    return context.json(user)
  })

  api.get('/api/board-users', (context) => context.json(identities.listUsers().map(sheetOf)))

  api.post('/api/board-users', async (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin && user.role !== 'director') {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    const draft = boardUserDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidBoardUser', issues: draft.error.issues }, 422)
    }
    return context.json(sheetOf(identities.enrolUser(draft.data)), 201)
  })

  api.patch('/api/board-users/:login', async (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const login = context.req.param('login')
    const draft = boardUserChangeSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidBoardUserChange', issues: draft.error.issues }, 422)
    }
    const change = draft.data
    if (change.superAdmin !== undefined && !user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    const manages = user.superAdmin || user.role === 'director'
    if (change.active !== undefined && !manages) {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    if (change.capacity !== undefined && !manages && user.login !== login) {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    let changed = identities.findUser(login)
    if (changed === null) {
      throw new UnknownAccountError(login)
    }
    if (change.active !== undefined && changed.superAdmin && !user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    if (change.superAdmin !== undefined) {
      changed = identities.changeSuperAdmin(login, change.superAdmin)
    }
    if (change.active !== undefined) {
      changed = identities.changeActive(login, change.active)
    }
    if (change.capacity !== undefined) {
      changed = identities.changeCapacity(login, change.capacity)
    }
    return context.json(sheetOf(changed))
  })

  api.post('/api/board-users/:login/verify-email', (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin && user.role !== 'director') {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    return context.json(sheetOf(identities.verifyEmail(context.req.param('login'))))
  })

  api.post('/api/board-users/:login/erase', (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    return context.json(sheetOf(identities.eraseUser(context.req.param('login'))))
  })

  api.put('/api/auth/profile',async (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const draft = profileSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidProfile', issues: draft.error.issues }, 422)
    }
    if (draft.data.displayName !== undefined) {
      identities.changeDisplayName(user.login, draft.data.displayName)
    }
    if (draft.data.email !== undefined) {
      identities.changeEmail(user.login, draft.data.email)
    }
    return context.json(identities.findUser(user.login))
  })

  api.put('/api/auth/password', async (context) => {
    const user = caller(context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE))
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const draft = passwordChangeSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidPasswordChange' }, 422)
    }
    try {
      identities.changePassword(user.login, draft.data.current, draft.data.next)
    } catch (error) {
      if (error instanceof PasswordRefusedError) {
        return context.json({ error: error.name, message: error.message }, 422)
      }
      throw error
    }
    deleteCookie(context, IDENTITY_COOKIE, { path: '/' })
    return context.json({ changed: true })
  })

  api.get('/api/auth/state', (context) =>
    context.json({ users: identities.countUsers(), enrolmentOpen: allowEnrolment() }),
  )

  return api
}
