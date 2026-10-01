import { rmSync } from 'node:fs'
import { join } from 'node:path'

const EVIDENCE_PREFIX = '.claude/evidence/'

export function clearVerdictFile(root: string, verdictPath: string): void {
  if (!verdictPath.startsWith(EVIDENCE_PREFIX) || verdictPath.includes('..')) {
    return
  }
  rmSync(join(root, verdictPath), { force: true })
}
