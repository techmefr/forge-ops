import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PARAMETERLESS_PATHS,
  PROJECT_PATHS,
  STORY_PATHS,
} from '../../../src/domain/Demo/DemoSnapshotPaths.js'

const SOURCE = fileURLToPath(new URL('../../../src/', import.meta.url))

const DECLARED_GET = /\.get\('(\/api[^']*)'/g

const OUTSIDE_THE_VISIT: readonly string[] = [
  '/api/auth/me',
  '/api/auth/whoami',
  '/api/batches/:id',
  '/api/auth/state',
  '/api/events',
  '/api/pilots/shots/:name',
  '/api/projects/:id/file',
  '/api/templates/:id/jsonl',
]

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

function routesTheBoardServes(): readonly string[] {
  const found = new Set<string>()
  for (const file of sourceFiles(SOURCE)) {
    for (const match of readFileSync(file, 'utf-8').matchAll(DECLARED_GET)) {
      found.add(match[1] ?? '')
    }
  }
  return [...found].sort()
}

describe('the frozen visit keeps up with the board it shows', () => {
  const snapshotted = [...PARAMETERLESS_PATHS, ...PROJECT_PATHS, ...STORY_PATHS]

  it('captures every readable route, or says out loud which ones it leaves out', () => {
    const uncovered = routesTheBoardServes().filter(
      (route) => !snapshotted.includes(route) && !OUTSIDE_THE_VISIT.includes(route),
    )
    expect(uncovered).toEqual([])
  })

  it('captures nothing the board does not serve', () => {
    const served = routesTheBoardServes()
    for (const path of snapshotted) {
      expect(served).toContain(path)
    }
  })

  it('leaves out only routes that cannot be frozen', () => {
    for (const path of OUTSIDE_THE_VISIT) {
      expect(snapshotted).not.toContain(path)
    }
  })

  it('names each captured route once', () => {
    expect([...new Set(snapshotted)]).toEqual(snapshotted)
  })
})
