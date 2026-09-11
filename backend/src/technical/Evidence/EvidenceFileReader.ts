import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { EvidenceRead, EvidenceReader } from '../../domain/Evidence/EvidenceRead.js'

export type EvidenceFileReaderInput = {
  root: string
}

function reasonOf(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOENT') {
    return 'fichier introuvable'
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return 'lecture refusee par le systeme de fichiers'
  }
  if (code === 'ELOOP') {
    return 'le chemin boucle sur lui-meme'
  }
  return error instanceof Error ? error.message : 'lecture impossible'
}

function insideOf(base: string, target: string): boolean {
  const inside = relative(base, target)
  return inside !== '' && !inside.startsWith('..') && !inside.startsWith(`${sep}..`) && !isAbsolute(inside)
}

export function createEvidenceFileReader({ root }: EvidenceFileReaderInput): EvidenceReader {
  return (path): EvidenceRead => {
    const target = join(root, path)
    try {
      const base = realpathSync(resolve(root))
      const walked = realpathSync(target)
      if (!insideOf(base, walked)) {
        return { kind: 'unreadable', reason: 'le chemin sort de l arbre des preuves' }
      }
      if (!statSync(walked).isFile()) {
        return { kind: 'unreadable', reason: "le chemin n'est pas un fichier" }
      }
      return { kind: 'read', content: readFileSync(walked, 'utf-8') }
    } catch (error) {
      return { kind: 'unreadable', reason: reasonOf(error) }
    }
  }
}
