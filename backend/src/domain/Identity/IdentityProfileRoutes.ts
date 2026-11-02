import type { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import type { IdentityApiInput } from './IdentityApi.js'
import type { CallerOf } from './IdentityApiSupport.js'
import { PasswordRefusedError } from './IdentityViolation.js'

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

export function mountIdentityProfileRoutes(
  api: Hono,
  { identities, callerOf }: Pick<IdentityApiInput, 'identities'> & { callerOf: CallerOf },
): void {
  api.put('/api/auth/profile', async (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const draft = await parseBody(context, profileSchema)
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
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const draft = await parseBody(context, passwordChangeSchema)
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
}
