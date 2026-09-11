import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createEvidenceFileReader } from '../../../src/technical/Evidence/EvidenceFileReader.js'

const RELATIVE = '.claude/evidence/FORGE-1/spec.md'

function rootWith(content: string | null): string {
  const root = mkdtempSync(join(tmpdir(), 'forge-evidence-'))
  if (content !== null) {
    const target = join(root, RELATIVE)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf-8')
  }
  return root
}

describe('createEvidenceFileReader', () => {
  it('reads the content of an evidence file under the root', () => {
    const read = createEvidenceFileReader({ root: rootWith('## Scope\nprose') })

    expect(read(RELATIVE)).toBe('## Scope\nprose')
  })

  it('returns nothing when the evidence file is absent', () => {
    const read = createEvidenceFileReader({ root: rootWith(null) })

    expect(read(RELATIVE)).toBeNull()
  })

  it('returns nothing when the evidence path is a directory', () => {
    const read = createEvidenceFileReader({ root: rootWith('prose') })

    expect(read('.claude/evidence/FORGE-1')).toBeNull()
  })
})
