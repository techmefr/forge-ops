export const GATE_SCRIPTS = ['lint', 'test', 'build:back', 'build:web'] as const

export function missingScripts(
  scripts: Readonly<Record<string, string>>,
  required: readonly string[],
): string[] {
  return required.filter((name) => (scripts[name] ?? '').trim() === '')
}

export function reportMissingScripts(missing: readonly string[]): string {
  if (missing.length === 0) {
    return 'Gate manifest complete: every required script is declared.'
  }
  const names = missing.join(', ')
  return `Gate manifest incomplete: package.json declares no command for ${names}. A gate step that runs a script which does not exist proves nothing.`
}
