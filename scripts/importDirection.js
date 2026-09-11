import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const REPOSITORY_ROOT = resolve(here, '..')

export const BASELINE_PATH = resolve(REPOSITORY_ROOT, 'architecture', 'import-direction-baseline.json')

export const LAYER_ROOTS = [
  { name: 'backend/src', directory: resolve(REPOSITORY_ROOT, 'backend', 'src') },
  { name: 'frontend/src', directory: resolve(REPOSITORY_ROOT, 'frontend', 'src'), alias: '@/' },
]

const SOURCE_EXTENSIONS = ['.ts', '.vue']
const RESOLUTION_CANDIDATES = ['.ts', '.vue', '.tsx', '/Index.ts', '/index.ts']

const toPosix = (value) => value.split(sep).join(posix.sep)

export const rootOfFile = (file) =>
  LAYER_ROOTS.find((root) => !toPosix(relative(root.directory, file)).startsWith('..')) ?? null

export const layerOf = (root, file) => {
  const relativePath = toPosix(relative(root.directory, file))
  if (relativePath.startsWith('..')) {
    return 'outside'
  }
  const segments = relativePath.split(posix.sep)
  return segments.length > 1 ? (segments[0] ?? 'root') : 'root'
}

export const labelOf = (root, file) => `${root.name}/${toPosix(relative(root.directory, file))}`

export const resolveTarget = (root, file, specifier) => {
  let candidate = null
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

export const edgeOf = (file, specifier) => {
  const root = rootOfFile(file)
  if (root === null) {
    return null
  }
  const target = resolveTarget(root, file, specifier)
  if (target === null) {
    return null
  }
  const fromLayer = layerOf(root, file)
  const toLayer = layerOf(root, target)
  if (fromLayer === toLayer) {
    return null
  }
  return { from: labelOf(root, file), to: labelOf(root, target), fromLayer, toLayer, root: root.name }
}

export const isViolation = (edge) => edge.fromLayer === 'technical' && edge.toLayer === 'domain'

export const edgeKey = (edge) => `${edge.from} -> ${edge.to}`

export const readBaseline = () => {
  if (!existsSync(BASELINE_PATH)) {
    return []
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

const IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g
const SIDE_EFFECT_PATTERN = /import\s+['"]([^'"]+)['"]/g

const collectSourceFiles = (directory) => {
  const files = []
  for (const entry of readdirSync(directory)) {
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

const readSpecifiers = (source) => {
  const specifiers = new Set()
  for (const pattern of [IMPORT_PATTERN, SIDE_EFFECT_PATTERN]) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) {
        specifiers.add(match[1])
      }
    }
  }
  return [...specifiers]
}

export const scanRoot = (root) => {
  const edges = []
  for (const file of collectSourceFiles(root.directory)) {
    for (const specifier of readSpecifiers(readFileSync(file, 'utf8'))) {
      const edge = edgeOf(file, specifier)
      if (edge !== null) {
        edges.push(edge)
      }
    }
  }
  return edges.sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)))
}

export const importDirectionRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      inverted:
        'OSDD direction: {{from}} is technical and must not import the domain file {{to}}. Pass what it needs in, or move the rule into the domain.',
    },
  },
  create(context) {
    const baseline = new Set(readBaseline())
    const check = (node, specifier) => {
      const edge = edgeOf(resolve(context.filename), specifier)
      if (edge === null || !isViolation(edge) || baseline.has(edgeKey(edge))) {
        return
      }
      context.report({ node, messageId: 'inverted', data: { from: edge.from, to: edge.to } })
    }
    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          check(node.source, node.source.value)
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          check(node.source, node.source.value)
        }
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node.source, node.source.value)
        }
      },
    }
  },
}

const isEntryPoint = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isEntryPoint) {
  const write = process.argv.includes('--write-baseline')
  const checkBaseline = process.argv.includes('--check-baseline')
  const current = []
  const lines = []
  for (const root of LAYER_ROOTS) {
    const edges = scanRoot(root)
    const violations = edges.filter(isViolation)
    lines.push(`\n${root.name}`)
    lines.push(`  cross-layer imports: ${edges.length}`)
    lines.push(`  respecting the direction: ${edges.length - violations.length}`)
    lines.push(`  technical -> domain: ${violations.length}`)
    const clusters = new Map()
    for (const violation of violations) {
      current.push(edgeKey(violation))
      clusters.set(violation.from, (clusters.get(violation.from) ?? 0) + 1)
    }
    for (const [file, count] of [...clusters].sort((left, right) => right[1] - left[1])) {
      lines.push(`    ${count} ${file}`)
    }
  }
  current.sort()
  lines.push(`\ntotal technical -> domain imports: ${current.length}`)
  process.stdout.write(`${lines.join('\n')}\n`)

  if (write) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
    process.stdout.write(`baseline written: ${current.length} entries\n`)
  }

  if (checkBaseline) {
    const live = new Set(current)
    const stale = readBaseline().filter((entry) => !live.has(entry))
    if (stale.length > 0) {
      process.stdout.write(
        `\nbaseline may only shrink: ${stale.length} recorded violations no longer exist. Run npm run arch:imports:baseline.\n${stale.join('\n')}\n`,
      )
      process.exit(1)
    }
    process.stdout.write('baseline is exact: every recorded violation still exists.\n')
  }
}
