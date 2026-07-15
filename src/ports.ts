import { createHash } from 'node:crypto'

export const DEFAULT_BASE_PORT = 4000
export const DEFAULT_PORT_RANGE = 2000

function hashToUint32(value: string): number {
  const digest = createHash('sha256').update(value).digest()
  return digest.readUInt32BE(0)
}

/**
 * Port de depart deterministe pour une branche. Deux branches distinctes
 * peuvent tomber sur le meme port : c'est le role de `resolvePort` de
 * lever la collision.
 */
export function allocatePort(
  branchName: string,
  basePort: number = DEFAULT_BASE_PORT,
  range: number = DEFAULT_PORT_RANGE,
): number {
  const hash = hashToUint32(branchName)
  return (hash % range) + basePort
}

/**
 * Retourne un port libre pour la branche : on part du port deterministe
 * puis on sonde lineairement dans la plage jusqu'a en trouver un non utilise.
 * Determinisme != absence de collision — sans ce sondage, deux branches qui
 * hashent sur le meme port se battraient pour le meme port.
 */
export function resolvePort(
  branchName: string,
  usedPorts: Set<number>,
  basePort: number = DEFAULT_BASE_PORT,
  range: number = DEFAULT_PORT_RANGE,
): number {
  const start = allocatePort(branchName, basePort, range)
  for (let offset = 0; offset < range; offset += 1) {
    const candidate = ((start - basePort + offset) % range) + basePort
    if (!usedPorts.has(candidate)) {
      return candidate
    }
  }
  throw new Error(`Aucun port libre dans la plage ${basePort}-${basePort + range - 1}`)
}

export function allocateSubdomain(branchName: string): string {
  const slug = branchName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug
}
