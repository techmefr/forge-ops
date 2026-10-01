import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = 'forge-ops'

function packageVersionFrom(start: string): string {
  let folder = start
  for (;;) {
    const candidate = join(folder, 'package.json')
    if (existsSync(candidate)) {
      const manifest = JSON.parse(readFileSync(candidate, 'utf-8')) as { name?: string; version?: string }
      if (manifest.name === PACKAGE_NAME && typeof manifest.version === 'string') {
        return manifest.version
      }
    }
    const parent = dirname(folder)
    if (parent === folder) {
      throw new Error(`No ${PACKAGE_NAME} package.json found above ${start}`)
    }
    folder = parent
  }
}

export const PACKAGE_VERSION: string = packageVersionFrom(dirname(fileURLToPath(import.meta.url)))

export function installedVersion(): string {
  return process.env.FORGE_VERSION ?? PACKAGE_VERSION
}

export function offeredVersion(): string {
  return process.env.FORGE_OFFERED_VERSION ?? installedVersion()
}
