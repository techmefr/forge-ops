import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { IdentityRepository } from './IdentityRepository.js'
import type { OpenedSession } from './Identity.js'
import {
  IdentityViolationError,
  LoginRefusedError,
  PasswordRefusedError,
} from './IdentityViolation.js'

import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordUnhashableError,
} from '../../technical/Auth/PasswordHash.js'
import { createLoginRateLimit, type LoginRateLimit } from '../../technical/Auth/LoginRateLimit.js'

export { IDENTITY_COOKIE }

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

const passwordChangeSchema = z.object({
  current: z.string().min(1).max(256),
  next: z.string().min(1).max(256),
})

export type IdentityApiInput = {
  identities: IdentityRepository
  allowEnrolment: () => boolean
  loginLimit?: LoginRateLimit
}

export function createIdentityApi({
  identities,
  allowEnrolment,
  loginLimit = createLoginRateLimit(),
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
    if (loginLimit.refuses(login)) {
      context.header('retry-after', String(Math.ceil(loginLimit.retryAfterMs(login) / 1000)))
      return context.json({ error: 'TooManyLoginAttempts' }, 429)
    }
    let opened: OpenedSession
    try {
      opened = identities.openSession(login, password)
    } catch (error) {
      loginLimit.recordFailure(login)
      throw error
    }
    loginLimit.forget(login)
    setCookie(context, IDENTITY_COOKIE, opened.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      expires: new Date(opened.expiresAt),
    })
    return context.json({ user: opened.user })
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

  api.put('/api/auth/profile', async (context) => {
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
