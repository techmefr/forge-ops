import { realpathSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export class PathOutsideRootError extends Error {
  readonly asked: string

  constructor(asked: string, root: string) {
    super(`le chemin ${asked} ne tient pas sous ${root}`)
    this.name = 'PathOutsideRootError'
    this.asked = asked
  }
}

function assertInside(root: string, walked: string, asked: string): string {
  const inside = relative(root, walked)
  if (inside === '' || inside.startsWith('..') || inside.startsWith(`${sep}..`) || isAbsolute(inside)) {
    throw new PathOutsideRootError(asked, root)
  }
  return walked
}

export function realPathInsideSync(root: string, asked: string): string {
  const base = realpathSync(resolve(root))
  return assertInside(base, realpathSync(resolve(base, asked)), asked)
}

export async function realPathInside(root: string, asked: string): Promise<string> {
  const base = await realpath(resolve(root))
  return assertInside(base, await realpath(resolve(base, asked)), asked)
}
