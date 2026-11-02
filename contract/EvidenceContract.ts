export type EvidenceRead =
  | { kind: 'read'; content: string }
  | { kind: 'unreadable'; reason: string }

export type EvidenceReader = (path: string, root?: string) => EvidenceRead
