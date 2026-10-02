import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'

const EVIDENCE_FOLDER = '.claude/evidence'

export class EvidenceWriteRefusedError extends Error {
  constructor(path: string, reason: string) {
    super(`the proof ${path} was not written: ${reason}`)
    this.name = 'EvidenceWriteRefusedError'
  }
}

export function writeEvidenceFile(root: string, path: string, content: string): void {
  const folder = resolve(root, EVIDENCE_FOLDER)
  const target = resolve(root, path)
  if (!target.startsWith(`${folder}${sep}`)) {
    throw new EvidenceWriteRefusedError(path, `it is not inside ${EVIDENCE_FOLDER}`)
  }
  mkdirSync(dirname(target), { recursive: true })
  const real = realpathSync(dirname(target))
  const top = realpathSync(root)
  if (real !== top && !real.startsWith(`${top}${sep}`)) {
    throw new EvidenceWriteRefusedError(path, 'it resolves outside the story worktree')
  }
  writeFileSync(join(real, basename(target)), content, 'utf-8')
}
