export type Topology = 'laptop' | 'vps' | 'split' | 'hosted'

export const TOPOLOGIES: readonly Topology[] = ['laptop', 'vps', 'split', 'hosted']

export type OidcChoice = {
  clientId: string
  clientSecret: string
}

export type MicrosoftChoice = OidcChoice & { tenant: string }

export type SetupAnswers = {
  topology: Topology
  publicInstanceUrl: string
  serverUrl: string
  superAdminLogin: string
  repositories: string
  allowedDomains: readonly string[]
  google: OidcChoice | null
  microsoft: MicrosoftChoice | null
}

export type SecretNeed = 'board_token' | 'instance_token' | 'super_admin_password'

const COMPOSE_FILES: Readonly<Record<Topology, string>> = {
  laptop: 'compose.laptop.yml',
  vps: 'compose.vps.yml',
  split: 'compose.split.yml',
  hosted: 'compose.hosted.yml',
}

const SECRETS: Readonly<Record<Topology, readonly SecretNeed[]>> = {
  laptop: ['board_token'],
  vps: ['board_token', 'instance_token', 'super_admin_password'],
  split: ['board_token'],
  hosted: ['board_token'],
}

const GUIDED_TENANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function composeFileOf(topology: Topology): string {
  return COMPOSE_FILES[topology]
}

export function generatedSecretsOf(topology: Topology): readonly SecretNeed[] {
  return SECRETS[topology]
}

export function hasAccounts(topology: Topology): boolean {
  return topology === 'laptop' || topology === 'vps'
}

export function redirectUriOf(origin: string, provider: 'google' | 'microsoft'): string {
  return `${origin.replace(/\/+$/, '')}/api/auth/oidc/${provider}/callback`
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s/]+/i.test(value.trim())
}

export function isSpecificTenant(tenant: string): boolean {
  return GUIDED_TENANT.test(tenant)
}

export function validateAnswers(answers: SetupAnswers): readonly string[] {
  const problems: string[] = []
  if (answers.topology === 'vps' && !isHttpUrl(answers.publicInstanceUrl)) {
    problems.push('the public instance address must start with http:// or https://')
  }
  if ((answers.topology === 'split' || answers.topology === 'hosted') && !isHttpUrl(answers.serverUrl)) {
    problems.push('the server address must start with http:// or https://')
  }
  if (answers.topology === 'vps' && !/^[a-z0-9][a-z0-9._-]*$/.test(answers.superAdminLogin)) {
    problems.push('the admin login must be lowercase letters, digits, dot, dash or underscore')
  }
  const isOidcWanted = answers.google !== null || answers.microsoft !== null
  if (isOidcWanted && answers.topology !== 'vps') {
    problems.push('Google and Microsoft sign-in need the vps topology, where the accounts live')
  }
  if (answers.microsoft !== null && !isSpecificTenant(answers.microsoft.tenant)) {
    problems.push('Microsoft needs a specific tenant id, not common or organizations')
  }
  return problems
}

export function envLinesOf(answers: SetupAnswers): readonly string[] {
  const lines: string[] = []
  if (answers.repositories !== '') {
    lines.push(`FORGE_REPOSITORIES=${answers.repositories}`)
  }
  if (answers.topology === 'vps') {
    lines.push(`FORGE_PUBLIC_INSTANCE_URL=${answers.publicInstanceUrl.replace(/\/+$/, '')}`)
    lines.push(`FORGE_SUPER_ADMIN_LOGIN=${answers.superAdminLogin}`)
  }
  if (answers.topology === 'split' || answers.topology === 'hosted') {
    lines.push(`FORGE_SERVER_URL=${answers.serverUrl.replace(/\/+$/, '')}`)
  }
  if (answers.allowedDomains.length > 0) {
    lines.push(`FORGE_OIDC_ALLOWED_DOMAINS=${answers.allowedDomains.join(',')}`)
  }
  if (answers.google !== null) {
    lines.push(`FORGE_OIDC_GOOGLE_CLIENT_ID=${answers.google.clientId}`)
    lines.push(`FORGE_OIDC_GOOGLE_CLIENT_SECRET=${answers.google.clientSecret}`)
  }
  if (answers.microsoft !== null) {
    lines.push(`FORGE_OIDC_MICROSOFT_CLIENT_ID=${answers.microsoft.clientId}`)
    lines.push(`FORGE_OIDC_MICROSOFT_CLIENT_SECRET=${answers.microsoft.clientSecret}`)
    lines.push(`FORGE_OIDC_MICROSOFT_TENANT=${answers.microsoft.tenant}`)
  }
  return lines
}
