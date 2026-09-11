import { isAbsolute, relative, resolve, sep } from 'node:path'

const MAX_PATH_LENGTH = 4096

const BACKSLASH = String.fromCharCode(92)

export class TouchedPathRefusedError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`le chemin touche ${path} est refuse : ${reason}`)
    this.name = 'TouchedPathRefusedError'
    this.path = path
  }
}

function slashed(path: string): string {
  return path.split(sep).join('/')
}

function withoutNoise(path: string, asked: string): string {
  const kept: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (kept.pop() === undefined) {
        throw new TouchedPathRefusedError(asked, 'il remonte au-dessus de la racine')
      }
      continue
    }
    kept.push(segment)
  }
  return kept.join('/')
}

function relativeToARoot(full: string, roots: readonly string[], asked: string): string {
  for (const root of roots) {
    const inside = relative(resolve(root), full)
    if (inside !== '' && !inside.startsWith('..') && !inside.startsWith(`${sep}..`) && !isAbsolute(inside)) {
      return slashed(inside)
    }
  }
  throw new TouchedPathRefusedError(asked, `il sort des racines autorisees : ${roots.join(', ')}`)
}

export function assertTouchedPath(path: string, roots: readonly string[]): string {
  const trimmed = path.trim()

  if (trimmed === '') {
    throw new TouchedPathRefusedError(path, 'il est vide')
  }
  if (trimmed.includes(String.fromCharCode(0))) {
    throw new TouchedPathRefusedError(path, 'il porte un octet nul')
  }
  if (trimmed.length > MAX_PATH_LENGTH) {
    throw new TouchedPathRefusedError(path, `il depasse ${MAX_PATH_LENGTH} caracteres`)
  }

  const unified = trimmed.split(BACKSLASH).join('/')
  const kept = isAbsolute(trimmed)
    ? relativeToARoot(resolve(trimmed), roots, path)
    : withoutNoise(unified, path)

  if (kept === '') {
    throw new TouchedPathRefusedError(path, 'il ne designe aucun fichier')
  }

  return kept
}
