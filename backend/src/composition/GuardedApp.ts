import { Hono } from 'hono'
import type { IdentityRepository } from '../domain/Identity/IdentityRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import { createStoryHandGuard } from '../domain/Story/StoryHandGuard.js'
import { createBrowserSessions } from '../technical/Auth/BrowserSession.js'
import { boardOrigins, isLocalOrigin } from '../technical/Auth/BoardOrigin.js'
import { deriveHookToken } from '../technical/Auth/BoardToken.js'
import { isLoopbackPeer } from '../technical/Auth/ClientAddress.js'
import { createTokenGuard } from '../technical/Auth/TokenGuard.js'
import { requestBodyLimit } from '../technical/Http/RequestBodyLimit.js'
import { securityHeaders } from '../technical/Http/SecurityHeaders.js'
import { createSessionApi } from '../technical/Http/SessionApi.js'
import type { BoardAccess } from './BoardAccess.js'

export type GuardedAppInput = {
  mode: 'local' | 'hub'
  token: string
  host: string
  port: number
  publicOrigin: string | null
  identities: IdentityRepository
  stories: StoryRepository
  access: BoardAccess
}

export function createGuardedApp({
  mode,
  token,
  host,
  port,
  publicOrigin,
  identities,
  stories,
  access,
}: GuardedAppInput): Hono {
  const browserSessions = createBrowserSessions()
  const app = new Hono()
  app.use('*', securityHeaders())
  app.use('/api/*', requestBodyLimit())
  app.get('/health', (context) =>
    context.json({ role: process.env.FORGE_ROLE ?? 'instance', mode, ready: true }),
  )
  app.use(
    '/api/*',
    createTokenGuard({
      token,
      allowedOrigins: boardOrigins(host, port, publicOrigin),
      hookToken: deriveHookToken(token),
      requireIdentity: mode === 'hub',
      readIdentity: (sessionToken) => identities.readSession(sessionToken),
      readBrowserSession: (sessionToken) => browserSessions.isOpen(sessionToken),
      allowSessionExchange: mode === 'local',
      allowLocalAutologin: mode === 'local',
      isLocalOrigin: (origin) => isLocalOrigin(origin, host, port),
      isLoopbackPeer,
    }),
  )
  app.get('/api/auth/whoami', (context) => context.json({ authenticated: true }))
  app.use(
    '/api/*',
    createStoryHandGuard({
      stories,
      isSuperAdmin: access.isSuperAdmin,
      isDirector: access.isDirector,
    }),
  )
  if (mode === 'local') {
    app.route('/', createSessionApi({ token, sessions: browserSessions }))
  }
  return app
}
