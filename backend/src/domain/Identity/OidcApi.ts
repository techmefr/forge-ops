import { Hono, type Context } from 'hono'
import { createHash, timingSafeEqual } from 'node:crypto'
import { setCookie } from 'hono/cookie'
import { cookieSecure } from '../../technical/Auth/SecureCookie.js'
import { clientAddressOf, trustProxyFromEnv } from '../../technical/Auth/ClientAddress.js'
import { createLoginRateLimit, type LoginRateLimit } from '../../technical/Auth/LoginRateLimit.js'
import { authorizeUrlOf, newPkce, type OidcFetch, type OidcProvider } from '../../technical/Auth/OidcProvider.js'
import { createOidcHandoffs, type OidcHandoffs } from '../../technical/Auth/OidcHandoffs.js'
import { createOidcTransactions, type OidcTransactions } from '../../technical/Auth/OidcTransactions.js'
import type { IdentityRepository } from './IdentityRepository.js'
import {
  TRANSACTION_COOKIE,
  TRANSACTION_COOKIE_PATH,
  bindingOf,
  mountOidcCallbackRoute,
  type DesktopHandoff,
} from './OidcCallbackRoute.js'

const TRANSACTION_COOKIE_MAX_AGE_SECONDS = 600
const REQUEST_CAP_PER_WINDOW = 30
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

export type OidcApiInput = {
  identities: IdentityRepository
  providers: readonly OidcProvider[]
  allowedDomains: readonly string[]
  publicOrigin: string | null
  send?: OidcFetch
  transactions?: OidcTransactions
  handoffs?: OidcHandoffs<DesktopHandoff>
  requestLimit?: LoginRateLimit
  trustProxy?: boolean
}

function isVerifierOf(challenge: string, verifier: string): boolean {
  const expected = Buffer.from(challenge)
  const actual = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

type StartRouteInput = {
  providers: readonly OidcProvider[]
  transactions: OidcTransactions
  isOverLimit: (context: Context, route: string) => boolean
  redirectUriOf: (name: string) => string
}

function mountOidcStartRoute(
  api: Hono,
  { providers, transactions, isOverLimit, redirectUriOf }: StartRouteInput,
): void {
  api.get('/api/auth/oidc/:provider/start', (context) => {
    if (isOverLimit(context, 'start')) {
      return context.json({ error: 'TooManyRequests' }, 429)
    }
    const provider = providers.find((candidate) => candidate.name === context.req.param('provider'))
    if (provider === undefined) {
      return context.json({ error: 'UnknownOidcProvider' }, 404)
    }
    const isDesktop = context.req.query('client') === 'desktop'
    const challenge = context.req.query('challenge') ?? ''
    if (isDesktop && !CHALLENGE_PATTERN.test(challenge)) {
      return context.json({ error: 'InvalidChallenge' }, 400)
    }
    const pkce = newPkce()
    const nonce = crypto.randomUUID()
    const state = transactions.open({
      provider: provider.name,
      nonce,
      verifier: pkce.verifier,
      isDesktop,
      challenge: isDesktop ? challenge : null,
    })
    setCookie(context, TRANSACTION_COOKIE, bindingOf(state), {
      path: TRANSACTION_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'Lax',
      secure: cookieSecure(context),
      maxAge: TRANSACTION_COOKIE_MAX_AGE_SECONDS,
    })
    return context.redirect(
      authorizeUrlOf(provider, redirectUriOf(provider.name), state, nonce, pkce.challenge),
    )
  })
}

export function createOidcApi({
  identities,
  providers,
  allowedDomains,
  publicOrigin,
  send = fetch,
  transactions = createOidcTransactions(),
  handoffs = createOidcHandoffs<DesktopHandoff>(),
  requestLimit = createLoginRateLimit({ attemptCap: REQUEST_CAP_PER_WINDOW }),
  trustProxy = trustProxyFromEnv(),
}: OidcApiInput): Hono {
  if (providers.length > 0 && (publicOrigin === null || publicOrigin === '')) {
    throw new Error('FORGE_PUBLIC_ORIGIN is required when an OIDC provider is configured')
  }
  const api = new Hono()

  function isOverLimit(context: Context, route: string): boolean {
    const key = `${route}:${clientAddressOf(context, trustProxy)}`
    if (requestLimit.refuses(key)) {
      context.header('retry-after', String(Math.ceil(requestLimit.retryAfterMs(key) / 1000)))
      return true
    }
    requestLimit.recordFailure(key)
    return false
  }

  function redirectUriOf(name: string): string {
    return `${publicOrigin}/api/auth/oidc/${name}/callback`
  }

  api.get('/api/auth/oidc/providers', (context) =>
    context.json(providers.map((provider) => provider.name)),
  )

  mountOidcStartRoute(api, { providers, transactions, isOverLimit, redirectUriOf })

  mountOidcCallbackRoute(api, {
    identities,
    providers,
    allowedDomains,
    send,
    transactions,
    handoffs,
    isOverLimit,
    redirectUriOf,
  })

  api.post('/api/auth/oidc/exchange', async (context) => {
    if (isOverLimit(context, 'exchange')) {
      return context.json({ error: 'TooManyRequests' }, 429)
    }
    const body = (await context.req.json().catch(() => null)) as { code?: unknown; verifier?: unknown } | null
    const handoff = typeof body?.code === 'string' ? handoffs.take(body.code) : null
    if (handoff === null || typeof body?.verifier !== 'string' || !isVerifierOf(handoff.challenge, body.verifier)) {
      return context.json({ error: 'UnknownHandoff' }, 401)
    }
    return context.json({ user: handoff.session.user, token: handoff.session.token })
  })

  return api
}
