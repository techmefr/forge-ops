export type EvidenceRead =
  | { kind: 'read'; content: string }
  | { kind: 'unreadable'; reason: string }

export type EvidenceReader = (path: string) => EvidenceRead

export class EvidenceUnreadableError extends Error {
  constructor(path: string, reason: string) {
    super(`la preuve ${path} est illisible, elle ne prouve rien : ${reason}`)
    this.name = 'EvidenceUnreadableError'
  }
}
