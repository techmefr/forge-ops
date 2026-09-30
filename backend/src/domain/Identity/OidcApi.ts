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
import { createOidcTransactions, type OidcTransactions } from '../../technical/Auth/OidcTransactions.js'
import type { IdentityRepository } from './IdentityRepository.js'
import { resolveExternalUser } from './ExternalIdentity.js'

const LANDING_PATH = '/'
const REFUSED_PATH = '/login?oidc=refused'

export type OidcApiInput = {
  identities: IdentityRepository
  providers: readonly OidcProvider[]
  allowedDomains: readonly string[]
  publicOrigin: string | null
  send?: OidcFetch
  transactions?: OidcTransactions
}

export function createOidcApi({
  identities,
  providers,
  allowedDomains,
  publicOrigin,
  send = fetch,
  transactions = createOidcTransactions(),
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
    const state = transactions.open({ provider: provider.name, nonce, verifier: pkce.verifier })
    return context.redirect(
      authorizeUrlOf(provider, redirectUriOf(context.req.url, provider.name), state, nonce, pkce.challenge),
    )
  })

  api.get('/api/auth/oidc/:provider/callback', async (context) => {
    const provider = providers.find((candidate) => candidate.name === context.req.param('provider'))
    const transaction = transactions.take(context.req.query('state') ?? '')
    const code = context.req.query('code') ?? ''
    if (provider === undefined || transaction === null || transaction.provider !== provider.name || code === '') {
      return context.redirect(REFUSED_PATH)
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
      setCookie(context, IDENTITY_COOKIE, opened.token, {
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
        secure: cookieSecure(context),
        expires: new Date(opened.expiresAt),
      })
      return context.redirect(LANDING_PATH)
    } catch {
      return context.redirect(REFUSED_PATH)
    }
  })

  return api
}
