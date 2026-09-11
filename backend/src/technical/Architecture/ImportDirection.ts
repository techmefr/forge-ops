import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'

export type ImportEdge = {
  from: string
  to: string
  fromLayer: string
  toLayer: string
}

export type LayerRoot = {
  name: string
  directory: string
  alias?: string
}

export type DirectionReport = {
  edges: ImportEdge[]
  respected: number
  violations: ImportEdge[]
}

const SOURCE_EXTENSIONS = ['.ts', '.vue']
const RESOLUTION_CANDIDATES = ['.ts', '.vue', '.tsx', '/Index.ts', '/index.ts']
const IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g
const SIDE_EFFECT_PATTERN = /import\s+['"]([^'"]+)['"]/g

const toPosix = (value: string): string => value.split(sep).join(posix.sep)

const collectSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full))
      continue
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      files.push(full)
    }
  }
  return files.sort()
}

const readSpecifiers = (source: string): string[] => {
  const specifiers: string[] = []
  for (const pattern of [IMPORT_PATTERN, SIDE_EFFECT_PATTERN]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier !== undefined) {
        specifiers.push(specifier)
      }
    }
  }
  return specifiers
}

const resolveTarget = (root: LayerRoot, file: string, specifier: string): string | null => {
  let candidate: string | null = null
  if (specifier.startsWith('.')) {
    candidate = resolve(dirname(file), specifier)
  } else if (root.alias && specifier.startsWith(root.alias)) {
    candidate = resolve(root.directory, specifier.slice(root.alias.length))
  }
  if (candidate === null) {
    return null
  }
  const stripped = candidate.endsWith('.js') ? candidate.slice(0, -'.js'.length) : candidate
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate
  }
  for (const extension of RESOLUTION_CANDIDATES) {
    const attempt = `${stripped}${extension}`
    if (existsSync(attempt) && statSync(attempt).isFile()) {
      return attempt
    }
  }
  return null
}

const layerOf = (root: LayerRoot, file: string): string => {
  const relativePath = toPosix(relative(root.directory, file))
  if (relativePath.startsWith('..')) {
    return 'outside'
  }
  const segments = relativePath.split(posix.sep)
  return segments.length > 1 ? (segments[0] ?? 'root') : 'root'
}

const labelOf = (root: LayerRoot, file: string): string =>
  `${root.name}/${toPosix(relative(root.directory, file))}`

export const analyseRoot = (root: LayerRoot): ImportEdge[] => {
  const edges: ImportEdge[] = []
  for (const file of collectSourceFiles(root.directory)) {
    const source = readFileSync(file, 'utf8')
    for (const specifier of new Set(readSpecifiers(source))) {
      const target = resolveTarget(root, file, specifier)
      if (target === null) {
        continue
      }
      const fromLayer = layerOf(root, file)
      const toLayer = layerOf(root, target)
      if (fromLayer === toLayer) {
        continue
      }
      edges.push({
        from: labelOf(root, file),
        to: labelOf(root, target),
        fromLayer,
        toLayer,
      })
    }
  }
  return edges.sort((left, right) => `${left.from}${left.to}`.localeCompare(`${right.from}${right.to}`))
}

export const isViolation = (edge: ImportEdge): boolean =>
  edge.fromLayer === 'technical' && edge.toLayer === 'domain'

export const reportOfRoot = (root: LayerRoot): DirectionReport => {
  const edges = analyseRoot(root)
  const violations = edges.filter(isViolation)
  return { edges, respected: edges.length - violations.length, violations }
}

export const edgeKey = (edge: ImportEdge): string => `${edge.from} -> ${edge.to}`

export const clusterCounts = (violations: ImportEdge[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const violation of violations) {
    counts.set(violation.from, (counts.get(violation.from) ?? 0) + 1)
  }
  return new Map([...counts.entries()].sort((left, right) => right[1] - left[1]))
}
