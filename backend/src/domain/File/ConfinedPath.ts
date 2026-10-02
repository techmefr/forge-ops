export class ConfinedPathRefusedError extends Error {
  readonly reason: string

  constructor(path: string, reason: string) {
    super(`le chemin ${path} est refuse : ${reason}`)
    this.name = 'ConfinedPathRefusedError'
    this.reason = reason
  }
}

export function assertConfinedPath(path: string): string {
  const trimmed = path.trim()

  if (trimmed === '') {
    throw new ConfinedPathRefusedError(path, 'il est vide')
  }
  if (trimmed.includes(String.fromCharCode(0))) {
    throw new ConfinedPathRefusedError(path, 'il porte un octet nul')
  }
  if (trimmed.includes('\\')) {
    throw new ConfinedPathRefusedError(path, 'les chemins se referencent avec des barres obliques')
  }
  if (trimmed.startsWith('/')) {
    throw new ConfinedPathRefusedError(path, 'il est absolu')
  }
  if (trimmed.split('/').includes('..')) {
    throw new ConfinedPathRefusedError(path, 'il remonte au-dessus du depot')
  }
  if (trimmed.endsWith('/')) {
    throw new ConfinedPathRefusedError(path, 'il designe un dossier, pas un fichier')
  }

  return trimmed
}

export function isConfinedPath(path: string): boolean {
  try {
    assertConfinedPath(path)
    return true
  } catch {
    return false
  }
}

export function relativeToDirectory(path: string, directory: string | null | undefined): string {
  if (!path.startsWith('/') || directory === null || directory === undefined || !directory.startsWith('/')) {
    return path
  }
  const base = directory.replace(/\/+$/, '')
  return base !== '' && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path
}
