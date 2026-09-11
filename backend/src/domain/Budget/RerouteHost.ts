export class RerouteHostRefusedError extends Error {
  readonly reason: string

  constructor(baseUrl: string, reason: string) {
    super(`le routeur ${baseUrl} est refuse : ${reason}`)
    this.name = 'RerouteHostRefusedError'
    this.reason = reason
  }
}

export const DEFAULT_ALLOWED_REROUTE_HOSTS: readonly string[] = ['api.anthropic.com']

export function allowedRerouteHostsOf(declared: string | undefined): readonly string[] {
  const listed = (declared ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')

  return listed.length === 0 ? DEFAULT_ALLOWED_REROUTE_HOSTS : listed
}

export function assertRerouteBaseUrl(baseUrl: string, allowedHosts: readonly string[]): string {
  const trimmed = baseUrl.trim()
  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    throw new RerouteHostRefusedError(baseUrl, "il ne s'analyse pas comme une adresse")
  }

  if (parsed.protocol !== 'https:') {
    throw new RerouteHostRefusedError(baseUrl, 'un routeur se joint en https, jamais en clair')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new RerouteHostRefusedError(baseUrl, 'une adresse de routeur ne porte pas d identifiants')
  }
  if (allowedHosts.length === 0) {
    throw new RerouteHostRefusedError(baseUrl, "aucun routeur n'est autorise")
  }
  if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new RerouteHostRefusedError(
      baseUrl,
      `${parsed.hostname} ne figure pas parmi les routeurs autorises : ${allowedHosts.join(', ')}`,
    )
  }

  return trimmed
}
