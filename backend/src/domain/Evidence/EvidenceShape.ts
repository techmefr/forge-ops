import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

export const MINIMUM_PROSE_WORDS = 40

export const EVIDENCE_SHAPE: Record<CheckpointName, readonly string[]> = {
  spec_done: ['scope', 'decisions'],
  arch_done: ['breakdown', 'risks'],
  tests_written: ['cases', 'run'],
  build_done: ['built', 'run'],
  verified: ['walked', 'observed'],
  reviewed: ['findings'],
}

export const REFERENCED_SECTIONS: readonly string[] = ['run']

export class EvidenceShapeRefusedError extends Error {
  constructor(path: string, reason: string) {
    super(`la preuve ${path} est refusee : ${reason}`)
    this.name = 'EvidenceShapeRefusedError'
  }
}

const HEADING = /^\s{0,3}#{1,6}\s+(.+)$/
const WORD = /[a-z0-9]/i
const RUN_REFERENCE = /https?:\/\/\S+|`[^`]+`|\brun\s+#?\d+/i

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

function bodyOf(lines: readonly string[], section: string): string {
  const body: string[] = []
  let inside = false
  for (const line of lines) {
    const heading = HEADING.exec(line)?.[1]
    if (heading !== undefined) {
      inside = carriesSection([heading.toLowerCase()], section)
      continue
    }
    if (inside) {
      body.push(line)
    }
  }
  return body.join('\n')
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

  const unreferenced = EVIDENCE_SHAPE[name]
    .filter((section) => REFERENCED_SECTIONS.includes(section))
    .filter((section) => !RUN_REFERENCE.test(bodyOf(lines, section)))
  if (unreferenced.length > 0) {
    throw new EvidenceShapeRefusedError(
      path,
      `la section ${unreferenced.join(', ')} ne pointe vers aucune execution : il y faut une url, un identifiant de run ou la commande exacte entre accents graves`,
    )
  }
}
