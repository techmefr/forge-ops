import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { cookieSecure } from '../../technical/Auth/SecureCookie.js'
import {
  authorizeUrlOf,
  exchangeCode,
  newPkce,
  type OidcFetch,
  type OidcProvider,
} from '../../technical/Auth/OidcProvider.js'
import { createOidcHandoffs, type OidcHandoffs } from '../../technical/Auth/OidcHandoffs.js'
import { createOidcTransactions, type OidcTransactions } from '../../technical/Auth/OidcTransactions.js'
import type { OpenedSession } from './Identity.js'
import type { IdentityRepository } from './IdentityRepository.js'
import { resolveExternalUser } from './ExternalIdentity.js'

const LANDING_PATH = '/'
const REFUSED_PATH = '/login?oidc=refused'
const DESKTOP_RETURN = 'forgeops://auth'
const DESKTOP_REFUSED = `${DESKTOP_RETURN}?error=refused`

export type OidcApiInput = {
  identities: IdentityRepository
  providers: readonly OidcProvider[]
  allowedDomains: readonly string[]
  publicOrigin: string | null
  send?: OidcFetch
  transactions?: OidcTransactions
  handoffs?: OidcHandoffs<OpenedSession>
}

export function createOidcApi({
  identities,
  providers,
  allowedDomains,
  publicOrigin,
  send = fetch,
  transactions = createOidcTransactions(),
  handoffs = createOidcHandoffs<OpenedSession>(),
}: OidcApiInput): Hono {
  const api = new Hono()

  function redirectUriOf(requestUrl: string, name: string): string {
    const origin = publicOrigin ?? new URL(requestUrl).origin
    return `${origin}/api/auth/oidc/${name}/callback`
  }

  api.get('/api/auth/oidc/providers', (context) =>
    context.json(providers.map((provider) => provider.name)),
  )

  api.get('/api/auth/oidc/:provider/start', (context) => {
    const provider = providers.find((candidate) => candidate.name === context.req.param('provider'))
    if (provider === undefined) {
      return context.json({ error: 'UnknownOidcProvider' }, 404)
    }
    const pkce = newPkce()
    const nonce = crypto.randomUUID()
    const state = transactions.open({
      provider: provider.name,
      nonce,
      verifier: pkce.verifier,
      isDesktop: context.req.query('client') === 'desktop',
    })
    return context.redirect(
      authorizeUrlOf(provider, redirectUriOf(context.req.url, provider.name), state, nonce, pkce.challenge),
    )
  })

  api.get('/api/auth/oidc/:provider/callback', async (context) => {
    const provider = providers.find((candidate) => candidate.name === context.req.param('provider'))
    const transaction = transactions.take(context.req.query('state') ?? '')
    const code = context.req.query('code') ?? ''
    if (provider === undefined || transaction === null || transaction.provider !== provider.name || code === '') {
      return context.redirect(transaction?.isDesktop === true ? DESKTOP_REFUSED : REFUSED_PATH)
    }
    try {
      const claims = await exchangeCode(
        provider,
        {
          code,
          redirectUri: redirectUriOf(context.req.url, provider.name),
          verifier: transaction.verifier,
          nonce: transaction.nonce,
        },
        send,
      )
      const user = resolveExternalUser(identities, claims, allowedDomains)
      const opened = identities.openSessionFor(user.login)
      if (transaction.isDesktop) {
        return context.redirect(`${DESKTOP_RETURN}?code=${handoffs.put(opened)}`)
      }
      setCookie(context, IDENTITY_COOKIE, opened.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
        secure: cookieSecure(context),
        expires: new Date(opened.expiresAt),
      })
      return context.redirect(LANDING_PATH)
    } catch {
      return context.redirect(transaction.isDesktop ? DESKTOP_REFUSED : REFUSED_PATH)
    }
  })

  api.post('/api/auth/oidc/exchange', async (context) => {
    const body = (await context.req.json().catch(() => null)) as { code?: unknown } | null
    const session = typeof body?.code === 'string' ? handoffs.take(body.code) : null
    if (session === null) {
      return context.json({ error: 'UnknownHandoff' }, 401)
    }
    return context.json({ user: session.user, token: session.token })
  })

  return api
}
