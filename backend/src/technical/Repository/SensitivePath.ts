const SENSITIVE_DIRECTORIES: readonly string[] = ['.ssh', '.gnupg', '.aws', '.kube', '.docker']

const SENSITIVE_NAMES: readonly RegExp[] = [
  /^\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|keystore|jks|crt|cer)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\..*)?$/i,
  /^\.forge-token/i,
  /\.(db|sqlite|sqlite3)(-[a-z]+)?$/i,
  /^\.(npmrc|netrc|pgpass|git-credentials)$/i,
  /^credentials(\.json)?$/i,
]

export function isSensitiveSegments(segments: readonly string[]): boolean {
  const named = segments.filter((segment) => segment !== '' && segment !== '.')
  if (named.some((segment) => SENSITIVE_DIRECTORIES.includes(segment))) {
    return true
  }
  if (named.some((segment) => SENSITIVE_NAMES.some((pattern) => pattern.test(segment)))) {
    return true
  }
  const claude = named.indexOf('.claude')
  return claude !== -1 && named.slice(claude + 1).some((segment) => /^settings\.local\.json$/i.test(segment))
}

export function isSensitivePath(path: string): boolean {
  return isSensitiveSegments(path.split(/[\\/]+/))
}
