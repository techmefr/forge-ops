import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

export type OidcProviderName = 'google' | 'microsoft'

export const OIDC_PROVIDER_NAMES: readonly OidcProviderName[] = ['google', 'microsoft']

export type OidcProvider = {
  name: OidcProviderName
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  issuer: string | null
  isEmailVerifiable: boolean
}

export type OidcClaims = {
  subject: string
  email: string
  displayName: string
}

export type OidcFetch = (url: string, init: RequestInit) => Promise<Response>

export class OidcRefusedError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'OidcRefusedError'
  }
}

const SPECIFIC_TENANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PKCE_BYTES = 32

function secretOf(env: NodeJS.ProcessEnv, prefix: string): string {
  const file = env[`${prefix}_CLIENT_SECRET_FILE`] ?? ''
  if (file !== '') {
    return readFileSync(file, 'utf8').replace(/\r?\n$/, '')
  }
  return env[`${prefix}_CLIENT_SECRET`] ?? ''
}

export function readOidcProviders(env: NodeJS.ProcessEnv = process.env): readonly OidcProvider[] {
  const providers: OidcProvider[] = []
  const googleId = env.FORGE_OIDC_GOOGLE_CLIENT_ID ?? ''
  const googleSecret = secretOf(env, 'FORGE_OIDC_GOOGLE')
  if (googleId !== '' && googleSecret !== '') {
    providers.push({
      name: 'google',
      clientId: googleId,
      clientSecret: googleSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      issuer: 'https://accounts.google.com',
      isEmailVerifiable: true,
    })
  }
  const microsoftId = env.FORGE_OIDC_MICROSOFT_CLIENT_ID ?? ''
  const microsoftSecret = secretOf(env, 'FORGE_OIDC_MICROSOFT')
  if (microsoftId !== '' && microsoftSecret !== '') {
    const tenant = env.FORGE_OIDC_MICROSOFT_TENANT ?? 'organizations'
    const base = `https://login.microsoftonline.com/${tenant}`
    providers.push({
      name: 'microsoft',
      clientId: microsoftId,
      clientSecret: microsoftSecret,
      authorizeUrl: `${base}/oauth2/v2.0/authorize`,
      tokenUrl: `${base}/oauth2/v2.0/token`,
      issuer: SPECIFIC_TENANT.test(tenant) ? `${base}/v2.0` : null,
      isEmailVerifiable: SPECIFIC_TENANT.test(tenant),
    })
  }
  return providers
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(PKCE_BYTES).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export function authorizeUrlOf(
  provider: OidcProvider,
  redirectUri: string,
  state: string,
  nonce: string,
  challenge: string,
): string {
  const query = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: redirectUri,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${provider.authorizeUrl}?${query.toString()}`
}

function payloadOf(idToken: string): Record<string, unknown> {
  const part = idToken.split('.')[1]
  if (part === undefined) {
    throw new OidcRefusedError('id_token malformed')
  }
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    throw new OidcRefusedError('id_token malformed')
  }
}

export async function exchangeCode(
  provider: OidcProvider,
  input: { code: string; redirectUri: string; verifier: string; nonce: string },
  send: OidcFetch,
  now: () => number = Date.now,
): Promise<OidcClaims> {
  const response = await send(provider.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: input.verifier,
    }).toString(),
  })
  if (!response.ok) {
    throw new OidcRefusedError('token endpoint refused the code')
  }
  const body = (await response.json()) as { id_token?: unknown }
  if (typeof body.id_token !== 'string') {
    throw new OidcRefusedError('no id_token returned')
  }
  return claimsOf(provider, payloadOf(body.id_token), input.nonce, now())
}

export function claimsOf(
  provider: OidcProvider,
  payload: Record<string, unknown>,
  nonce: string,
  nowMs: number,
): OidcClaims {
  const audience = payload.aud
  const isAudienceOk = Array.isArray(audience) ? audience.includes(provider.clientId) : audience === provider.clientId
  if (!isAudienceOk) {
    throw new OidcRefusedError('id_token audience mismatch')
  }
  if (payload.nonce !== nonce) {
    throw new OidcRefusedError('id_token nonce mismatch')
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) {
    throw new OidcRefusedError('id_token expired')
  }
  if (provider.issuer !== null && payload.iss !== provider.issuer) {
    throw new OidcRefusedError('id_token issuer mismatch')
  }
  const subject = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
  if (subject === '' || email === '') {
    throw new OidcRefusedError('id_token carries no subject or email')
  }
  const isVerified = provider.name === 'google' ? payload.email_verified === true : provider.isEmailVerifiable
  if (!isVerified) {
    throw new OidcRefusedError('email not verified by the provider')
  }
  const displayName = typeof payload.name === 'string' && payload.name !== '' ? payload.name : email
  return { subject: `${provider.name}:${subject}`, email, displayName }
}
