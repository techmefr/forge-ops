import { Hono } from 'hono'
import { createHash, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
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

const TRANSACTION_COOKIE = 'oidc_tx'
const TRANSACTION_COOKIE_PATH = '/api/auth/oidc'
const TRANSACTION_COOKIE_MAX_AGE_SECONDS = 600
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const LANDING_PATH = '/'
const REFUSED_PATH = '/login?oidc=refused'
const DESKTOP_RETURN = 'forgeops://auth'
const DESKTOP_REFUSED = `${DESKTOP_RETURN}?error=refused`

type DesktopHandoff = { session: OpenedSession; challenge: string }

export type OidcApiInput = {
  identities: IdentityRepository
  providers: readonly OidcProvider[]
  allowedDomains: readonly string[]
  publicOrigin: string | null
  send?: OidcFetch
  transactions?: OidcTransactions
  handoffs?: OidcHandoffs<DesktopHandoff>
}

function bindingOf(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}

function isVerifierOf(challenge: string, verifier: string): boolean {
  const expected = Buffer.from(challenge)
  const actual = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function createOidcApi({
  identities,
  providers,
  allowedDomains,
  publicOrigin,
  send = fetch,
  transactions = createOidcTransactions(),
  handoffs = createOidcHandoffs<DesktopHandoff>(),
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
      authorizeUrlOf(provider, redirectUriOf(context.req.url, provider.name), state, nonce, pkce.challenge),
    )
  })

  api.get('/api/auth/oidc/:provider/callback', async (context) => {
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
          redirectUri: redirectUriOf(context.req.url, provider.name),
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

  api.post('/api/auth/oidc/exchange', async (context) => {
    const body = (await context.req.json().catch(() => null)) as { code?: unknown; verifier?: unknown } | null
    const handoff = typeof body?.code === 'string' ? handoffs.take(body.code) : null
    if (handoff === null || typeof body?.verifier !== 'string' || !isVerifierOf(handoff.challenge, body.verifier)) {
      return context.json({ error: 'UnknownHandoff' }, 401)
    }
    return context.json({ user: handoff.session.user, token: handoff.session.token })
  })

  return api
}
