import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NPM_PLACEHOLDER = 'no test specified'

export function projectTestCommand(root: string, override: string | undefined = process.env.FORGE_TEST_COMMAND): string | null {
  if (override !== undefined && override.trim() !== '') {
    return override.trim()
  }
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    const scripts = (manifest as { scripts?: Record<string, unknown> }).scripts
    const test = scripts?.test
    if (typeof test !== 'string' || test.trim() === '' || test.includes(NPM_PLACEHOLDER)) {
      return null
    }
    return 'npm test'
  } catch {
    return null
  }
}
