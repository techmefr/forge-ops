import { describe, expect, it } from 'vitest'
import type { Criterion } from '../../../src/domain/Criterion/Criterion.js'
import { whatTheEpicDidNotGet } from '../../../src/domain/Criterion/EpicAnswer.js'

function criterion(over: Partial<Criterion> = {}): Criterion {
  return {
    id: 1,
    storyId: 7,
    reference: 'AC-1',
    statement: 'la liste est paginee par vingt',
    persona: null,
    expectsRefusal: false,
    evidencePath: '.claude/evidence/criteria.md',
    satisfied: true,
    ...over,
  }
}

describe('tying the delivery back to what the epic asked for', () => {
  it('lets a story through when every criterion it carries is proven', () => {
    expect(whatTheEpicDidNotGet({ businessIntent: 'gerer les mails', criteria: [criterion()] })).toEqual([])
  })

  it('refuses a story that answers the epic with no criterion at all', () => {
    const missing = whatTheEpicDidNotGet({ businessIntent: 'gerer les mails', criteria: [] })

    expect(missing.join(' ')).toContain('aucun critere')
  })

  it('names the criteria the epic asked for and never got', () => {
    const missing = whatTheEpicDidNotGet({
      businessIntent: 'gerer les mails',
      criteria: [criterion(), criterion({ id: 2, reference: 'AC-2', satisfied: false, evidencePath: null })],
    })

    expect(missing.join(' ')).toContain('AC-2')
  })

  it('leaves the proven criterion out of the refusal', () => {
    const missing = whatTheEpicDidNotGet({
      businessIntent: 'gerer les mails',
      criteria: [criterion(), criterion({ id: 2, reference: 'AC-2', satisfied: false, evidencePath: null })],
    })

    expect(missing.join(' ')).not.toContain('AC-1')
  })

  it('refuses a criterion declared satisfied with no evidence behind it', () => {
    const missing = whatTheEpicDidNotGet({
      businessIntent: 'gerer les mails',
      criteria: [criterion({ evidencePath: null })],
    })

    expect(missing.join(' ')).toContain('sans preuve')
  })

  it('refuses an epic that never said what it wanted, there is nothing to answer', () => {
    const missing = whatTheEpicDidNotGet({ businessIntent: '   ', criteria: [criterion()] })

    expect(missing.join(' ')).toContain('intention')
  })
})
