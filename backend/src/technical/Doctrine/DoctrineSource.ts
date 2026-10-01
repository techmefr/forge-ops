import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMAND_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/

export type DoctrineSourceInput = {
  forgeRoot: string
  checkoutOf: (storyId: number) => string
}

export function createDoctrineSource({ forgeRoot, checkoutOf }: DoctrineSourceInput) {
  return (storyId: number, command: string): string | null => {
    if (!COMMAND_FILE.test(command)) {
      return null
    }
    const candidates = [join(checkoutOf(storyId), '.claude', 'commands', command), join(forgeRoot, '.claude', 'commands', command)]
    const found = candidates.find((path) => existsSync(path))
    return found === undefined ? null : readFileSync(found, 'utf-8').trim()
  }
}
