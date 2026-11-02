export type { EvidenceRead, EvidenceReader } from '../../../../contract/EvidenceContract.js'

export class EvidenceUnreadableError extends Error {
  constructor(path: string, reason: string) {
    super(`la preuve ${path} est illisible, elle ne prouve rien : ${reason}`)
    this.name = 'EvidenceUnreadableError'
  }
}
