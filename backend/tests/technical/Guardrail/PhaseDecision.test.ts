import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { decideOnPhasePayload, decideOnToolCall } from '../../../src/technical/Guardrail/PhaseDecision.js'

const DENY_PATH = join(process.cwd(), '.claude-deny.json')

function phase(payload: unknown, declared: string | null) {
  return decideOnPhasePayload(JSON.stringify(payload), declared)
}

function call(payload: unknown, declared: string | null, denyPath: string = DENY_PATH) {
  return decideOnToolCall(JSON.stringify(payload), { denyPath, phase: declared })
}

describe('decideOnPhasePayload', () => {
  it('lets a spec session read a file', () => {
    expect(phase({ tool_name: 'Read', tool_input: { file_path: 'backend/src/forge.ts' } }, 'spec')).toEqual({
      allowed: true,
    })
  })

  it('blocks a spec session that tries to write code', () => {
    const decision = phase({ tool_name: 'Write', tool_input: { file_path: 'backend/src/forge.ts' } }, 'spec')

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('spec')
  })

  it('lets a code session write code', () => {
    expect(phase({ tool_name: 'Write', tool_input: { file_path: 'backend/src/forge.ts' } }, 'code')).toEqual({
      allowed: true,
    })
  })

  it('blocks a review session that tries to run a migration', () => {
    const decision = phase({ tool_name: 'Write', tool_input: { file_path: 'backend/src/Migration.ts' } }, 'review')

    expect(decision.allowed).toBe(false)
  })

  it('blocks every tool when no phase is declared, rather than protecting nothing', () => {
    const decision = phase({ tool_name: 'Read', tool_input: { file_path: 'backend/src/forge.ts' } }, null)

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('precaution')
  })

  it('blocks every tool when the declared phase is unknown, rather than protecting nothing', () => {
    const decision = phase({ tool_name: 'Read', tool_input: { file_path: 'backend/src/forge.ts' } }, 'deploiement')

    expect(decision.allowed).toBe(false)
  })

  it('blocks when the payload is not json, rather than protecting nothing', () => {
    const decision = decideOnPhasePayload('{ not json', 'code')

    expect(decision.allowed).toBe(false)
  })

  it('blocks when the payload carries no tool name, rather than protecting nothing', () => {
    const decision = phase({ tool_input: { file_path: 'backend/src/forge.ts' } }, 'code')

    expect(decision.allowed).toBe(false)
  })
})

describe('decideOnToolCall', () => {
  it('still blocks a force push in a phase that may use bash', () => {
    const decision = call({ tool_name: 'Bash', tool_input: { command: 'git push --force' } }, 'ship')

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('git push --force')
  })

  it('still lets a lease-protected force push through in a phase that may use bash', () => {
    expect(call({ tool_name: 'Bash', tool_input: { command: 'git push --force-with-lease' } }, 'ship')).toEqual({
      allowed: true,
    })
  })

  it('blocks bash in a phase whose policy has no bash', () => {
    const decision = call({ tool_name: 'Bash', tool_input: { command: 'npm test' } }, 'spec')

    expect(decision.allowed).toBe(false)
  })

  it('blocks when the deny list cannot be read, even in an allowed phase', () => {
    const decision = call({ tool_name: 'Bash', tool_input: { command: 'npm test' } }, 'code', '/tmp/nexistepas.json')

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('hors service')
  })
})
