import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
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

export function createEvidenceFileReader({ root }: EvidenceFileReaderInput): EvidenceReader {
  return (path): EvidenceRead => {
    const target = join(root, path)
    try {
      if (!statSync(target).isFile()) {
        return { kind: 'unreadable', reason: "le chemin n'est pas un fichier" }
      }
      return { kind: 'read', content: readFileSync(target, 'utf-8') }
    } catch (error) {
      return { kind: 'unreadable', reason: reasonOf(error) }
    }
  }
}
