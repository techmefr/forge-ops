import type { OidcClaims } from '../../technical/Auth/OidcProvider.js'
import type { IdentityRepository } from './IdentityRepository.js'
import type { BoardUser } from './Identity.js'

const LOGIN_PATTERN = /[^a-z0-9._-]/g
const MAX_LOGIN_ATTEMPTS = 50

export class ExternalIdentityRefusedError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'ExternalIdentityRefusedError'
  }
}

export function loginOf(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase().replace(LOGIN_PATTERN, '')
  return local.replace(/^[^a-z0-9]+/, '') || 'user'
}

function freeLogin(identities: IdentityRepository, email: string): string {
  const base = loginOf(email)
  for (let attempt = 0; attempt < MAX_LOGIN_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`
    if (identities.findUser(candidate) === null) {
      return candidate
    }
  }
  throw new ExternalIdentityRefusedError('no free login for this address')
}

export function resolveExternalUser(
  identities: IdentityRepository,
  claims: OidcClaims,
  allowedDomains: readonly string[],
): BoardUser {
  const linked = identities.findUserByExternalSubject(claims.subject)
  if (linked !== null) {
    return linked
  }
  const sameEmail = identities.findUserByEmail(claims.email)
  if (sameEmail !== null && (!claims.isEmailVerified || identities.findVerifiedUserByEmail(claims.email) === null)) {
    throw new ExternalIdentityRefusedError('this address cannot be linked to its account')
  }
  if (sameEmail !== null) {
    return identities.linkExternalSubject(sameEmail.login, claims.subject)
  }
  const domain = claims.email.split('@')[1] ?? ''
  if (!allowedDomains.includes(domain)) {
    throw new ExternalIdentityRefusedError('this address has no account and its domain is not allowed')
  }
  return identities.enrolExternalUser({
    login: freeLogin(identities, claims.email),
    displayName: claims.displayName,
    email: claims.email,
    isEmailVerified: claims.isEmailVerified,
    role: 'architect',
    subject: claims.subject,
  })
}

export function readAllowedDomains(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  return (env.FORGE_OIDC_ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain !== '')
}
