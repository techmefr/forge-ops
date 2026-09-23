import { describe, expect, it } from 'vitest'
import { refusalOf, SEED_WORKFLOW } from '../../../src/domain/Workflow/Workflow.js'
import type { WorkflowPhaseEntry } from '../../../src/domain/Workflow/Workflow.js'

function without(phase: string): readonly WorkflowPhaseEntry[] {
  return SEED_WORKFLOW.filter((entry) => entry.phase !== phase)
}

describe('refusalOf', () => {
  it('accepte le workflow seme depuis PHASE_CONTRACTS', () => {
    expect(refusalOf(SEED_WORKFLOW)).toBeNull()
  })

  it('refuse un workflow qui perd une phase', () => {
    expect(refusalOf(without('review'))).toEqual({ reason: 'MissingPhase', phase: 'review' })
  })

  it('refuse une phase inconnue', () => {
    expect(refusalOf([...SEED_WORKFLOW, { ...SEED_WORKFLOW[0]!, phase: 'sieste' as never }])).toEqual({
      reason: 'UnknownPhase',
      phase: 'sieste',
    })
  })

  it('refuse deux entrees pour la meme phase', () => {
    expect(refusalOf([...SEED_WORKFLOW, SEED_WORKFLOW[0]!])).toEqual({
      reason: 'RepeatedPhase',
      phase: SEED_WORKFLOW[0]!.phase,
    })
  })

  it('refuse un agent sans nom', () => {
    const withEmptyAgent = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'spec' ? { ...entry, agentName: '  ' } : entry,
    )
    expect(refusalOf(withEmptyAgent)).toEqual({ reason: 'EmptyAgentName', phase: 'spec' })
  })

  it('refuse une commande sans nom', () => {
    const withEmptyCommand = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'spec' ? { ...entry, command: '' } : entry,
    )
    expect(refusalOf(withEmptyCommand)).toEqual({ reason: 'EmptyCommand', phase: 'spec' })
  })
})
