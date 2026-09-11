import { describe, expect, it } from 'vitest'
import {
  assertEvidenceShape,
  EVIDENCE_SHAPE,
  EvidenceShapeRefusedError,
  MINIMUM_PROSE_WORDS,
} from '../../../src/domain/Evidence/EvidenceShape.js'

const PATH = '.claude/evidence/FORGE-1/spec.md'

function prose(words: number): string {
  return Array.from({ length: words }, (_unused, index) => `mot${index}`).join(' ')
}

function specProof(body: string = prose(MINIMUM_PROSE_WORDS)): string {
  return `# spec FORGE-1\n\n## Scope retained\n\n${body}\n\n## Key decisions\n\n${body}\n`
}

describe('assertEvidenceShape', () => {
  it('accepts a spec proof that carries its sections and real prose', () => {
    expect(() => assertEvidenceShape('spec_done', PATH, specProof())).not.toThrow()
  })

  it('refuses an empty file', () => {
    expect(() => assertEvidenceShape('spec_done', PATH, '')).toThrow(EvidenceShapeRefusedError)
  })

  it('refuses a file made of whitespace only', () => {
    expect(() => assertEvidenceShape('spec_done', PATH, '   \n\t\n  ')).toThrow(EvidenceShapeRefusedError)
  })

  it('refuses a one line file that only repeats the checkpoint name', () => {
    expect(() => assertEvidenceShape('spec_done', PATH, 'spec_done')).toThrow(EvidenceShapeRefusedError)
  })

  it('refuses sections without prose under them', () => {
    expect(() => assertEvidenceShape('spec_done', PATH, specProof(prose(3)))).toThrow(
      EvidenceShapeRefusedError,
    )
  })

  it('does not count heading words as prose', () => {
    const headings = Array.from(
      { length: MINIMUM_PROSE_WORDS },
      (_unused, index) => `## scope decisions section ${index}`,
    ).join('\n')
    expect(() => assertEvidenceShape('spec_done', PATH, headings)).toThrow(EvidenceShapeRefusedError)
  })

  it('refuses a spec proof that misses the scope section', () => {
    const body = prose(MINIMUM_PROSE_WORDS)
    expect(() =>
      assertEvidenceShape('spec_done', PATH, `## Key decisions\n\n${body}\n`),
    ).toThrow(EvidenceShapeRefusedError)
  })

  it('names the missing section in the refusal', () => {
    const body = prose(MINIMUM_PROSE_WORDS)
    expect(() => assertEvidenceShape('spec_done', PATH, `## Scope retained\n\n${body}\n`)).toThrow(
      /decisions/,
    )
  })

  it('accepts a section heading whatever its heading level or case', () => {
    const body = prose(MINIMUM_PROSE_WORDS)
    expect(() =>
      assertEvidenceShape('spec_done', PATH, `#### SCOPE\n${body}\n###### Decisions\n${body}\n`),
    ).not.toThrow()
  })

  it('refuses a section named in prose instead of in a heading', () => {
    expect(() =>
      assertEvidenceShape(
        'spec_done',
        PATH,
        `le scope et les decisions sont la ${prose(MINIMUM_PROSE_WORDS)}`,
      ),
    ).toThrow(EvidenceShapeRefusedError)
  })

  it('demands its own sections for every checkpoint kind', () => {
    const body = prose(MINIMUM_PROSE_WORDS)
    for (const [name, sections] of Object.entries(EVIDENCE_SHAPE)) {
      const shaped = `${sections.map((section) => `## ${section}`).join(`\n${body}\n`)}\n${body}\n`
      expect(() => assertEvidenceShape(name as keyof typeof EVIDENCE_SHAPE, PATH, shaped)).not.toThrow()
      expect(() => assertEvidenceShape(name as keyof typeof EVIDENCE_SHAPE, PATH, body)).toThrow(
        EvidenceShapeRefusedError,
      )
    }
  })
})
