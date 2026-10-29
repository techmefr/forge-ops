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

export const DROID_MANIFEST: AgentManifest = {
  name: 'droid',
  command: 'droid',
  environmentPrefixes: ['FACTORY_'],
  args: [
    'exec',
    '--output-format',
    'stream-json',
    '--auto',
    'medium',
    '--cwd',
    '{cwd}',
    { whenSet: 'model', args: ['--model', '{model}'] },
    '{prompt}',
  ],
  abilities: ['stream'],
}

export const COPILOT_MANIFEST: AgentManifest = {
  name: 'copilot',
  command: 'copilot',
  environmentPrefixes: ['COPILOT_', 'GH_', 'GITHUB_TOKEN'],
  args: ['--prompt', '{prompt}', '--allow-all'],
  abilities: ['stream'],
}

export const AGENT_MANIFESTS: readonly AgentManifest[] = [
  OPENCODE_MANIFEST,
  KIMI_MANIFEST,
  DROID_MANIFEST,
  COPILOT_MANIFEST,
]
