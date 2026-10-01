import { describe, expect, it } from 'vitest'
import { builtinModules } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(__dirname, '../../../..')

type Manifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sourcesUnder(path)
    }
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

function packageOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier)
}

function importedPackages(directory: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of sourcesUnder(join(root, directory))) {
    const text = readFileSync(file, 'utf-8')
    for (const match of text.matchAll(/(?:^|\s)from\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const specifier = match[1] ?? match[2] ?? ''
      const bare = !specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('@contract/') && !specifier.startsWith('/')
      if (bare && !specifier.startsWith('node:') && !builtinModules.includes(specifier)) {
        found.set(packageOf(specifier), file)
      }
    }
  }
  return found
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as Manifest
const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
])

describe('the packages the sources import', () => {
  it('declares the Tauri API the desktop token vault imports', () => {
    expect(Object.keys(manifest.dependencies ?? {})).toContain('@tauri-apps/api')
  })

  it.each(['frontend/src', 'backend/src'])('are all declared in package.json: %s', (directory) => {
    const missing = [...importedPackages(directory)].filter(([name]) => !declared.has(name))

    expect(missing).toEqual([])
  })
})
