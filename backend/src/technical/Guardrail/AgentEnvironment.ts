const EXACT_NAMES = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LANGUAGE',
  'TERM',
  'TMPDIR',
  'TZ',
  'PWD',
  'COLORTERM',
  'NODE_PATH',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'FORGE_DB_PATH',
  'FORGE_DENY_PATH',
  'FORGE_STORY_REFERENCE',
  'FORGE_PHASE',
])

const PREFIXES = ['LC_', 'XDG_', 'ANTHROPIC_', 'CLAUDE_CODE_', 'CLAUDE_CONFIG_']

const CODEX_PREFIXES = ['OPENAI_', 'CODEX_']

export type AgentEnvironmentInput = {
  source: NodeJS.ProcessEnv
  extraPrefixes?: readonly string[]
}

export const FORWARD_ENV_VARIABLE = 'FORGE_AGENT_FORWARD_ENV'

const FORWARDABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function forwardedNamesOf(source: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    (source[FORWARD_ENV_VARIABLE] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => FORWARDABLE_NAME.test(name) && name !== FORWARD_ENV_VARIABLE),
  )
}

export function agentEnvironmentOf({ source, extraPrefixes = [] }: AgentEnvironmentInput): Record<string, string> {
  const prefixes = [...PREFIXES, ...extraPrefixes]
  const forwarded = forwardedNamesOf(source)
  const allowed: Record<string, string> = {}
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (EXACT_NAMES.has(name) || forwarded.has(name) || prefixes.some((prefix) => name.startsWith(prefix))) {
      allowed[name] = value
    }
  }
  return allowed
}

export function codexAgentEnvironmentOf(source: NodeJS.ProcessEnv): Record<string, string> {
  return agentEnvironmentOf({ source, extraPrefixes: CODEX_PREFIXES })
}
