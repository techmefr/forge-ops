import { describe, expect, it } from 'vitest'
import { readVerdict, isSafeSegment } from '../../../src/domain/Autopilot/StepVerdict.js'
import { stepBriefOf, verdictPathOf } from '../../../src/domain/Autopilot/StepBrief.js'
import type { EvidenceReader } from '../../../src/domain/Evidence/EvidenceRead.js'

function readerOf(content: string | null): EvidenceReader {
  return () => (content === null ? { kind: 'unreadable', reason: 'missing' } : { kind: 'read', content })
}

describe('readVerdict', () => {
  it('reads a pass with its reason', () => {
    const reading = readVerdict(readerOf('{"status":"pass","reason":"done"}'), '/work', 'FORGE-1', 'spec')

    expect(reading).toEqual({ kind: 'found', verdict: { status: 'pass', reason: 'done' } })
  })

  it('reads fail and blocked verdicts', () => {
    expect(readVerdict(readerOf('{"status":"fail"}'), '/work', 'FORGE-1', 'spec')).toMatchObject({
      verdict: { status: 'fail' },
    })
    expect(readVerdict(readerOf('{"status":"blocked","reason":"which?"}'), '/work', 'FORGE-1', 'spec')).toMatchObject({
      verdict: { status: 'blocked', reason: 'which?' },
    })
  })

  it('says missing when the agent wrote nothing', () => {
    expect(readVerdict(readerOf(null), '/work', 'FORGE-1', 'spec')).toEqual({
      kind: 'missing',
      path: '.claude/evidence/FORGE-1/spec.verdict.json',
    })
  })

  it('refuses text that is not JSON and statuses it does not know', () => {
    expect(readVerdict(readerOf('all good'), '/work', 'FORGE-1', 'spec').kind).toBe('invalid')
    expect(readVerdict(readerOf('{"status":"great"}'), '/work', 'FORGE-1', 'spec').kind).toBe('invalid')
  })

  it('refuses a story reference or a step key that would leave the evidence folder', () => {
    expect(readVerdict(readerOf('{"status":"pass"}'), '/work', '../etc', 'spec').kind).toBe('invalid')
    expect(readVerdict(readerOf('{"status":"pass"}'), '/work', 'FORGE-1', 'a/b').kind).toBe('invalid')
    expect(isSafeSegment('FORGE-1')).toBe(true)
    expect(isSafeSegment('..')).toBe(false)
  })
})

describe('stepBriefOf', () => {
  it('tells the agent where to write the verdict and the proof', () => {
    const brief = stepBriefOf({ storyReference: 'FORGE-1', stepKey: 'spec', proves: 'spec_done' }).join('\n')

    expect(brief).toContain(verdictPathOf('FORGE-1', 'spec'))
    expect(brief).toContain('.claude/evidence/FORGE-1/spec_done.md')
    expect(brief).toContain('blocked')
  })

  it('skips the proof for a step that proves nothing', () => {
    const brief = stepBriefOf({ storyReference: 'FORGE-1', stepKey: 'ship', proves: null }).join('\n')

    expect(brief).not.toContain('.md')
  })

  it('carries the rejection of the previous attempt, bounded', () => {
    const brief = stepBriefOf({
      storyReference: 'FORGE-1',
      stepKey: 'spec',
      proves: null,
      feedback: `reason ${'x'.repeat(9000)}`,
    }).join('\n')

    expect(brief).toContain('rejected')
    expect(brief.length).toBeLessThan(4500)
  })
})
