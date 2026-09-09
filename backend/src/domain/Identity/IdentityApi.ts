import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { IdentityRepository } from './IdentityRepository.js'
import { IdentityViolationError, LoginRefusedError } from './IdentityViolation.js'

export const IDENTITY_COOKIE = 'forge_identity'

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
  password: z.string().min(1).max(256),
  role: z.enum(['director', 'architect']),
})

export type IdentityApiInput = {
  identities: IdentityRepository
  allowEnrolment: () => boolean
}

export function createIdentityApi({ identities, allowEnrolment }: IdentityApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof LoginRefusedError) {
      return context.json({ error: error.name, message: error.message }, 401)
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
    const opened = identities.openSession(credentials.data.login, credentials.data.password)
    setCookie(context, IDENTITY_COOKIE, opened.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      expires: new Date(opened.expiresAt),
    })
    return context.json({ user: opened.user })
  })

  api.post('/api/auth/logout', (context) => {
    const token = context.req.header('x-forge-identity')
    if (token !== undefined) {
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

  api.get('/api/auth/state', (context) =>
    context.json({ users: identities.countUsers(), enrolmentOpen: allowEnrolment() }),
  )

  return api
}
