import type { Context, Hono } from 'hono'
import { createHash } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import { cookieSecure } from '../../technical/Auth/SecureCookie.js'
import { exchangeCode, type OidcFetch, type OidcProvider } from '../../technical/Auth/OidcProvider.js'
import type { OidcHandoffs } from '../../technical/Auth/OidcHandoffs.js'
import type { OidcTransactions } from '../../technical/Auth/OidcTransactions.js'
import type { OpenedSession } from './Identity.js'
import type { IdentityRepository } from './IdentityRepository.js'
import { resolveExternalUser } from './ExternalIdentity.js'

export const TRANSACTION_COOKIE = 'oidc_tx'
export const TRANSACTION_COOKIE_PATH = '/api/auth/oidc'
const LANDING_PATH = '/'
const REFUSED_PATH = '/login?oidc=refused'
export const DESKTOP_RETURN = 'forgeops://auth'
const DESKTOP_REFUSED = `${DESKTOP_RETURN}?error=refused`

export type DesktopHandoff = { session: OpenedSession; challenge: string }

export function bindingOf(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}

export type OidcCallbackDeps = {
  identities: IdentityRepository
  providers: readonly OidcProvider[]
  allowedDomains: readonly string[]
  send: OidcFetch
  transactions: OidcTransactions
  handoffs: OidcHandoffs<DesktopHandoff>
  isOverLimit: (context: Context, route: string) => boolean
  redirectUriOf: (name: string) => string
}

export function mountOidcCallbackRoute(
  api: Hono,
  { identities, providers, allowedDomains, send, transactions, handoffs, isOverLimit, redirectUriOf }: OidcCallbackDeps,
): void {
  api.get('/api/auth/oidc/:provider/callback', async (context) => {
    if (isOverLimit(context, 'callback')) {
      return context.json({ error: 'TooManyRequests' }, 429)
    }
    const provider = providers.find((candidate) => candidate.name === context.req.param('provider'))
    const state = context.req.query('state') ?? ''
    const transaction = transactions.take(state)
    const bound = getCookie(context, TRANSACTION_COOKIE)
    deleteCookie(context, TRANSACTION_COOKIE, { path: TRANSACTION_COOKIE_PATH })
    const code = context.req.query('code') ?? ''
    if (provider === undefined || transaction === null || transaction.provider !== provider.name || bound !== bindingOf(state) || code === '') {
      return context.redirect(transaction?.isDesktop === true ? DESKTOP_REFUSED : REFUSED_PATH)
    }
    try {
      const claims = await exchangeCode(
        provider,
        {
          code,
          redirectUri: redirectUriOf(provider.name),
          verifier: transaction.verifier,
          nonce: transaction.nonce,
        },
        send,
      )
      const user = resolveExternalUser(identities, claims, allowedDomains)
      const opened = identities.openSessionFor(user.login)
      if (transaction.isDesktop) {
        return context.redirect(`${DESKTOP_RETURN}?code=${handoffs.put({ session: opened, challenge: transaction.challenge ?? '' })}`)
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
}
