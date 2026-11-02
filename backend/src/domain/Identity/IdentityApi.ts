import { Hono } from 'hono'
import type { IdentityRepository } from './IdentityRepository.js'
import { IdentityViolationError, LoginRefusedError, PasswordRefusedError } from './IdentityViolation.js'
import { createCallerOf } from './IdentityApiSupport.js'
import { mountIdentityProfileRoutes } from './IdentityProfileRoutes.js'
import { mountIdentitySessionRoutes } from './IdentitySessionRoutes.js'
import { mountIdentityUserRoutes } from './IdentityUserRoutes.js'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { PasswordUnhashableError } from '../../technical/Auth/PasswordHash.js'
import { trustProxyFromEnv } from '../../technical/Auth/ClientAddress.js'
import { createLoginRateLimit, type LoginRateLimit } from '../../technical/Auth/LoginRateLimit.js'

export { IDENTITY_COOKIE }
export { DESKTOP_CLIENT_HEADER, DESKTOP_CLIENT_VALUE, SETUP_TOKEN_HEADER } from './IdentityApiSupport.js'

const CLIENT_ATTEMPT_CAP = 30

export type IdentityApiInput = {
  identities: IdentityRepository
  allowEnrolment: () => boolean
  setupToken?: string | null
  loginLimit?: LoginRateLimit
  clientLimit?: LoginRateLimit
  trustProxy?: boolean
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
  const callerOf = createCallerOf(identities)

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

  mountIdentitySessionRoutes(api, { identities, allowEnrolment, setupToken, loginLimit, clientLimit, trustProxy, callerOf })
  mountIdentityUserRoutes(api, { identities, callerOf })
  mountIdentityProfileRoutes(api, { identities, callerOf })
  return api
}
