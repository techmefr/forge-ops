import type { AgentManifest } from './AgentManifest.js'

export const OPENCODE_MANIFEST: AgentManifest = {
  name: 'opencode',
  command: 'opencode',
  environmentPrefixes: ['OPENCODE_', 'OPENAI_', 'OPENROUTER_'],
  args: ['run', '--format', 'json', '--auto', '--dir', '{cwd}', { whenSet: 'model', args: ['--model', '{model}'] }, '{prompt}'],
  abilities: ['stream'],
}

export const KIMI_MANIFEST: AgentManifest = {
  name: 'kimi',
  command: 'kimi',
  environmentPrefixes: ['KIMI_', 'MOONSHOT_'],
  args: [
    '--print',
    '--output-format',
    'stream-json',
    '--work-dir',
    '{cwd}',
    { whenSet: 'model', args: ['--model', '{model}'] },
    '--prompt',
    '{prompt}',
  ],
  abilities: ['stream'],
}

export const AGENT_MANIFESTS: readonly AgentManifest[] = [OPENCODE_MANIFEST, KIMI_MANIFEST]
