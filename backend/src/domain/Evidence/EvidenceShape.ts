import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

export const MINIMUM_PROSE_WORDS = 40

export const EVIDENCE_SHAPE: Record<CheckpointName, readonly string[]> = {
  spec_done: ['scope', 'decisions'],
  arch_done: ['breakdown', 'risks'],
  tests_written: ['cases', 'output'],
  build_done: ['built', 'output'],
  verified: ['walked', 'observed'],
  reviewed: ['findings'],
}

export class EvidenceShapeRefusedError extends Error {
  constructor(path: string, reason: string) {
    super(`la preuve ${path} est refusee : ${reason}`)
    this.name = 'EvidenceShapeRefusedError'
  }
}

const HEADING = /^\s{0,3}#{1,6}\s+(.+)$/
const WORD = /[a-z0-9]/i

function headingsOf(lines: readonly string[]): readonly string[] {
  return lines.flatMap((line) => {
    const heading = HEADING.exec(line)?.[1]
    return heading === undefined ? [] : [heading.toLowerCase()]
  })
}

function proseWordsOf(lines: readonly string[]): number {
  return lines
    .filter((line) => HEADING.exec(line) === null)
    .flatMap((line) => line.split(/\s+/))
    .filter((word) => WORD.test(word)).length
}

function carriesSection(headings: readonly string[], section: string): boolean {
  return headings.some((heading) =>
    heading
      .split(/[^a-z0-9]+/)
      .some((token) => token === section || token.startsWith(section)),
  )
}

export function assertEvidenceShape(name: CheckpointName, path: string, content: string): void {
  if (content.trim() === '') {
    throw new EvidenceShapeRefusedError(path, 'le fichier est vide')
  }

  const lines = content.split(/\r?\n/)
  const words = proseWordsOf(lines)
  if (words < MINIMUM_PROSE_WORDS) {
    throw new EvidenceShapeRefusedError(
      path,
      `elle ne porte que ${words} mots hors titres, il en faut ${MINIMUM_PROSE_WORDS}`,
    )
  }

  const headings = headingsOf(lines)
  const missing = EVIDENCE_SHAPE[name].filter((section) => !carriesSection(headings, section))
  if (missing.length > 0) {
    throw new EvidenceShapeRefusedError(
      path,
      `il manque la section ${missing.join(', ')} attendue pour ${name}`,
    )
  }
}
