export const EVIDENCE_ROOT = '.claude/evidence/'

export class EvidencePathRefusedError extends Error {
  constructor(path: string, reason: string) {
    super(`le chemin de preuve ${path} est refuse : ${reason}`)
    this.name = 'EvidencePathRefusedError'
  }
}

export function assertEvidencePath(path: string): string {
  const trimmed = path.trim()

  if (trimmed === '') {
    throw new EvidencePathRefusedError(path, 'il est vide')
  }
  if (trimmed.includes(String.fromCharCode(0))) {
    throw new EvidencePathRefusedError(path, 'il porte un octet nul')
  }
  if (trimmed.includes('\\')) {
    throw new EvidencePathRefusedError(path, 'les preuves se referencent avec des barres obliques')
  }
  if (trimmed.startsWith('/')) {
    throw new EvidencePathRefusedError(path, 'il est absolu')
  }
  if (!trimmed.startsWith(EVIDENCE_ROOT)) {
    throw new EvidencePathRefusedError(path, `il sort de ${EVIDENCE_ROOT}`)
  }
  if (trimmed.split('/').includes('..')) {
    throw new EvidencePathRefusedError(path, `il remonte au-dessus de ${EVIDENCE_ROOT}`)
  }
  if (trimmed === EVIDENCE_ROOT || trimmed.endsWith('/')) {
    throw new EvidencePathRefusedError(path, 'il designe un dossier, pas un fichier')
  }

  return trimmed
}
