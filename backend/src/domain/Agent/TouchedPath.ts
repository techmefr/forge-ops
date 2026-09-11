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

export function assertTouchedPath(path: string): string {
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

  const slashed = trimmed.split(BACKSLASH).join('/')
  const kept: string[] = []
  for (const segment of slashed.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (kept.pop() === undefined) {
        throw new TouchedPathRefusedError(path, 'il remonte au-dessus de la racine')
      }
      continue
    }
    kept.push(segment)
  }
  if (kept.length === 0) {
    throw new TouchedPathRefusedError(path, 'il ne designe aucun fichier')
  }

  return slashed.startsWith('/') ? `/${kept.join('/')}` : kept.join('/')
}
