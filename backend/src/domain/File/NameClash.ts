export type NameClash = {
  name: string
  paths: readonly string[]
}

const FACELESS: readonly string[] = ['index', 'main', 'types', 'readme']

const CODE: readonly string[] = ['ts', 'tsx', 'vue', 'js', 'jsx', 'mjs', 'py', 'go', 'php', 'rb', 'rs']

function extensionOf(path: string): string {
  return (path.split('.').pop() ?? '').toLowerCase()
}

function stemOf(path: string): string {
  const name = path.split('/').pop() ?? ''
  return name.replace(/\.[a-z]+$/, '')
}

function isMirror(path: string): boolean {
  return /\.(test|spec)\.[a-z]+$/.test(path)
}

function keyOf(stem: string): string {
  return stem.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/e?s?$/, '')
}

export function clashesOf(paths: readonly string[]): readonly NameClash[] {
  const groups = new Map<string, { name: string; paths: Set<string> }>()
  for (const path of paths) {
    const stem = stemOf(path)
    const extension = extensionOf(path)
    if (isMirror(path) || !CODE.includes(extension) || FACELESS.includes(stem.toLowerCase())) {
      continue
    }
    const key = `${extension}:${keyOf(stem)}`
    const group = groups.get(key) ?? { name: stem, paths: new Set<string>() }
    group.paths.add(path)
    groups.set(key, group)
  }

  return [...groups.values()]
    .filter((group) => group.paths.size > 1)
    .map((group) => ({ name: group.name, paths: [...group.paths].sort() }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
