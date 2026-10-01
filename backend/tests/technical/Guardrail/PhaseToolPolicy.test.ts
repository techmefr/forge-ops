import { describe, expect, it } from 'vitest'
import { PHASE_CONTRACTS } from '../../../src/domain/Dispatch/Dispatch.js'
import { EVIDENCE_ROOT } from '../../../src/domain/Evidence/EvidencePath.js'
import { toolsOfPhase, allowsTool, EVIDENCE_FOLDER } from '../../../src/technical/Guardrail/PhaseToolPolicy.js'
import { UnknownPhaseError } from '../../../src/technical/Guardrail/GuardrailViolation.js'

describe('phase tool policy', () => {
  it('declares a tool list for every phase the dispatcher knows', () => {
    for (const contract of PHASE_CONTRACTS) {
      expect(toolsOfPhase(contract.phase).length).toBeGreaterThan(0)
    }
  })

  it('confines evidence writes to the evidence root of the domain', () => {
    expect(EVIDENCE_FOLDER).toBe(EVIDENCE_ROOT)
  })

  it('lets a spec session read the repository', () => {
    expect(allowsTool('spec', 'Read')).toBe(true)
  })

  it('keeps a spec session away from writing code', () => {
    expect(allowsTool('spec', 'Write')).toBe(false)
    expect(allowsTool('spec', 'Edit')).toBe(false)
  })

  it('lets a code session write code', () => {
    expect(allowsTool('code', 'Write')).toBe(true)
    expect(allowsTool('code', 'Edit')).toBe(true)
  })

  it('keeps a review session away from writing code', () => {
    expect(allowsTool('review', 'Write')).toBe(false)
  })

  it('refuses an unknown tool in every phase', () => {
    for (const contract of PHASE_CONTRACTS) {
      expect(allowsTool(contract.phase, 'DeleteEverything')).toBe(false)
    }
  })

  it('throws on a phase the policy does not declare, rather than allowing it', () => {
    expect(() => toolsOfPhase('deploiement')).toThrow(UnknownPhaseError)
  })
})
