import { assertConfinedPath, ConfinedPathRefusedError } from '../File/ConfinedPath.js'

export const EVIDENCE_ROOT = '.claude/evidence/'

export class EvidencePathRefusedError extends Error {
  constructor(path: string, reason: string) {
    super(`le chemin de preuve ${path} est refuse : ${reason}`)
    this.name = 'EvidencePathRefusedError'
  }
}

export function assertEvidencePath(path: string): string {
  let confined: string
  try {
    confined = assertConfinedPath(path)
  } catch (refusal) {
    if (refusal instanceof ConfinedPathRefusedError) {
      throw new EvidencePathRefusedError(path, refusal.reason)
    }
    throw refusal
  }

  if (!confined.startsWith(EVIDENCE_ROOT)) {
    throw new EvidencePathRefusedError(path, `il sort de ${EVIDENCE_ROOT}`)
  }
  if (confined === EVIDENCE_ROOT) {
    throw new EvidencePathRefusedError(path, 'il designe un dossier, pas un fichier')
  }

  return confined
}
