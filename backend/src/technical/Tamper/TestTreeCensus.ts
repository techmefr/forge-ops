import { readdirSync, readFileSync, realpathSync, statSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { addCensus, censusOfSource, EMPTY_CENSUS, type TestCensus } from '../../domain/Tamper/TestCensus.js'

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

function isDirectory(entry: Dirent, path: string): boolean {
  if (entry.isDirectory()) {
    return true
  }
  if (!entry.isSymbolicLink()) {
    return false
  }
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function censusOfTree(root: string): TestCensus {
  const visited = new Set<string>()

  function walk(directory: string): TestCensus {
    let resolved: string
    try {
      resolved = realpathSync(directory)
    } catch {
      return EMPTY_CENSUS
    }
    if (visited.has(resolved)) {
      return EMPTY_CENSUS
    }
    visited.add(resolved)

    let entries
    try {
      entries = readdirSync(resolved, { withFileTypes: true })
    } catch {
      return EMPTY_CENSUS
    }

    let census = EMPTY_CENSUS
    for (const entry of entries) {
      const path = join(resolved, entry.name)
      if (isDirectory(entry, path)) {
        census = addCensus(census, walk(path))
        continue
      }
      if (!TEST_FILE.test(entry.name)) {
        continue
      }
      try {
        census = addCensus(census, censusOfSource(readFileSync(path, 'utf-8')))
      } catch {
        continue
      }
    }
    return census
  }

  return walk(root)
}
