import type { DriverAbility } from '../../../../contract/DriverContract.js'

type ManifestArgument =
  | string
  | { whenSet: 'model'; args: readonly string[] }

export type AgentManifest = {
  name: string
  command: string
  environmentPrefixes: readonly string[]
  args: readonly ManifestArgument[]
  abilities: readonly DriverAbility[]
}

type ManifestValues = {
  prompt: string
  cwd: string
  model?: string
}

function substitute(template: string, values: ManifestValues): string {
  return template.replace(/\{(prompt|cwd|model)\}/g, (_match, key: keyof ManifestValues) => values[key] ?? '')
}

export function argumentsOf(manifest: AgentManifest, values: ManifestValues): readonly string[] {
  return manifest.args.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [substitute(entry, values)]
    }
    const wanted = values[entry.whenSet]
    return wanted === undefined || wanted === '' ? [] : entry.args.map((arg) => substitute(arg, values))
  })
}
