import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { EvidenceRead, EvidenceReader } from '../../domain/Evidence/EvidenceRead.js'
import { PathOutsideRootError, realPathInsideSync } from '../File/ConfinedRealPath.js'

export type EvidenceFileReaderInput = {
  root: string
  evidenceRoot: string
}

function reasonOf(error: unknown): string {
  if (error instanceof PathOutsideRootError) {
    return 'le chemin sort de l arbre des preuves'
  }
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

export function createEvidenceFileReader({ root, evidenceRoot }: EvidenceFileReaderInput): EvidenceReader {
  const confinedRoot = join(root, evidenceRoot)

  return (path): EvidenceRead => {
    try {
      const walked = realPathInsideSync(confinedRoot, join(root, path))
      if (!statSync(walked).isFile()) {
        return { kind: 'unreadable', reason: "le chemin n'est pas un fichier" }
      }
      return { kind: 'read', content: readFileSync(walked, 'utf-8') }
    } catch (error) {
      return { kind: 'unreadable', reason: reasonOf(error) }
    }
  }
}
