import type { ZoneOverview } from './Zone.js'

export type PathKind = 'tests' | 'interface' | 'schema' | 'code'

const EMPTY_ZONE = 'Aucun fichier touche pour l instant.'

export function kindOfPath(path: string): PathKind {
  const segments = path.split('/')
  if (segments.includes('tests') || path.endsWith('.test.ts')) {
    return 'tests'
  }
  if (path.endsWith('.vue')) {
    return 'interface'
  }
  if (path.endsWith('.sql')) {
    return 'schema'
  }
  return 'code'
}

function dominantKind(paths: readonly string[]): PathKind {
  const tally = new Map<PathKind, number>()
  for (const path of paths) {
    const kind = kindOfPath(path)
    tally.set(kind, (tally.get(kind) ?? 0) + 1)
  }
  return [...tally.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'code'
}

export function describeZone({ files }: ZoneOverview): string {
  if (files.length === 0) {
    return EMPTY_ZONE
  }
  const references = [...new Set(files.map((file) => file.storyReference))].sort()
  const count = `${files.length} fichier${files.length > 1 ? 's' : ''}`
  const who = references.length === 1 ? `par ${references[0]}` : `par ${references.join(' et ')}`
  return `${count} ${who}. Surtout du ${dominantKind(files.map((file) => file.path))}.`
}
