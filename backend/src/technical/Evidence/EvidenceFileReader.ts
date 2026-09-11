import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type EvidenceFileReaderInput = {
  root: string
}

export function createEvidenceFileReader({ root }: EvidenceFileReaderInput): (path: string) => string | null {
  return (path) => {
    const target = join(root, path)
    try {
      if (!statSync(target).isFile()) {
        return null
      }
      return readFileSync(target, 'utf-8')
    } catch {
      return null
    }
  }
}
