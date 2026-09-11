import { isAbsolute, relative, resolve, sep } from 'node:path'

export class CheckoutPathRefusedError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`le chemin de depot ${path} est refuse : ${reason}`)
    this.name = 'CheckoutPathRefusedError'
    this.path = path
  }
}

function contains(root: string, candidate: string): boolean {
  const inside = relative(resolve(root), candidate)
  if (inside === '') {
    return true
  }
  return !inside.startsWith('..') && !inside.startsWith(`${sep}..`) && !isAbsolute(inside)
}

export function assertCheckoutPath(path: string, allowedRoots: readonly string[]): string {
  const trimmed = path.trim()

  if (trimmed === '') {
    throw new CheckoutPathRefusedError(path, 'il est vide')
  }
  if (trimmed.includes(String.fromCharCode(0))) {
    throw new CheckoutPathRefusedError(path, 'il porte un octet nul')
  }
  if (!isAbsolute(trimmed)) {
    throw new CheckoutPathRefusedError(path, 'il est relatif')
  }

  const full = resolve(trimmed)
  if (!allowedRoots.some((root) => contains(root, full))) {
    throw new CheckoutPathRefusedError(path, `il sort des racines autorisees : ${allowedRoots.join(', ')}`)
  }

  return full
}
