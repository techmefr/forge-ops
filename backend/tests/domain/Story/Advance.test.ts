import { describe, expect, it } from 'vitest'
import { stateAfterCheckpoint } from '../../../src/domain/Story/Advance.js'
import { CHECKPOINT_SEQUENCE } from '../../../src/domain/Checkpoint/Checkpoint.js'
import { KANBAN_COLUMNS } from '../../../src/domain/Story/Story.js'

describe('stateAfterCheckpoint', () => {
  it('sends a written spec to the architecture', () => {
    expect(stateAfterCheckpoint('spec_done')).toBe('architecture')
  })

  it('puts a settled plan in front of the human', () => {
    expect(stateAfterCheckpoint('arch_done')).toBe('plan_review')
  })

  it('leaves the story where it is while the tests are being written', () => {
    expect(stateAfterCheckpoint('tests_written')).toBeNull()
  })

  it('sends green tests to the gate', () => {
    expect(stateAfterCheckpoint('build_done')).toBe('gating')
  })

  it('sends a verified story to the review', () => {
    expect(stateAfterCheckpoint('verified')).toBe('reviewing')
  })

  it('sends a reviewed story to the merge', () => {
    expect(stateAfterCheckpoint('reviewed')).toBe('shipping')
  })

  it('answers for every checkpoint of the definition of done', () => {
    for (const name of CHECKPOINT_SEQUENCE) {
      expect(() => stateAfterCheckpoint(name)).not.toThrow()
    }
  })

  it('reaches every kanban column but the store and the ones a human opens', () => {
    const reached = CHECKPOINT_SEQUENCE.map((name) => stateAfterCheckpoint(name))
    const opened = ['backlog', 'building', 'flagged', 'done']

    for (const column of KANBAN_COLUMNS) {
      expect(reached.includes(column.key) || opened.includes(column.key), column.key).toBe(true)
    }
  })
})
