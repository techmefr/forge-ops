import { describe, expect, it } from 'vitest'
import { decideOnScopePayload, WRITING_TOOLS } from '../../../src/technical/Guardrail/ScopeDecision.js'
import type { ScopeReservation } from '../../../src/domain/Foremerge/ForemergeRepository.js'

const HELD: readonly ScopeReservation[] = [
  {
    id: 1,
    storyId: 1,
    storyReference: 'FORGE-1',
    pathPrefix: 'backend/src/domain/Mail',
    symbols: [],
    reservedAt: '2026-09-09 18:00:00',
  },
]

function ask(payload: unknown, reference: string | null = 'FORGE-1') {
  return decideOnScopePayload(JSON.stringify(payload), {
    reference,
    read: () => HELD,
    root: '/repo',
  })
}

describe('a tool that does not write', () => {
  it('is left alone', () => {
    expect(ask({ tool_name: 'Read', tool_input: { file_path: '/repo/backend/src/x.ts' } }).allowed).toBe(
      true,
    )
  })

  it('names the tools it watches', () => {
    expect(WRITING_TOOLS).toContain('Write')
    expect(WRITING_TOOLS).toContain('Edit')
  })
})

describe('a write inside the reserved folder', () => {
  it('goes through', () => {
    const decision = ask({
      tool_name: 'Write',
      tool_input: { file_path: '/repo/backend/src/domain/Mail/MailRepository.ts' },
    })

    expect(decision.allowed).toBe(true)
  })

  it('goes through on a relative path too', () => {
    const decision = ask({
      tool_name: 'Edit',
      tool_input: { file_path: 'backend/src/domain/Mail/MailRepository.ts' },
    })

    expect(decision.allowed).toBe(true)
  })
})

describe('a write outside the reserved folder', () => {
  it('is refused', () => {
    const decision = ask({
      tool_name: 'Write',
      tool_input: { file_path: '/repo/backend/src/domain/Zone/Zone.ts' },
    })

    expect(decision.allowed).toBe(false)
  })

  it('says why, so the agent can reserve or move', () => {
    const decision = ask({
      tool_name: 'Write',
      tool_input: { file_path: '/repo/backend/src/domain/Zone/Zone.ts' },
    })

    expect(decision.reason).toContain('hors du perimetre')
  })
})

describe('a write with no story behind it', () => {
  it('goes through, the human at the board is not governed', () => {
    const decision = ask(
      { tool_name: 'Write', tool_input: { file_path: '/repo/backend/src/domain/Zone/Zone.ts' } },
      null,
    )

    expect(decision.allowed).toBe(true)
  })
})

describe('a payload it cannot read', () => {
  it('refuses a write whose path is missing, and says so plainly', () => {
    expect(ask({ tool_name: 'Write', tool_input: {} })).toEqual({
      allowed: false,
      reason: 'Write sans chemin de fichier ne se verifie pas',
    })
  })

  it('refuses a write whose path is blank, and says so plainly', () => {
    expect(ask({ tool_name: 'Write', tool_input: { file_path: '   ' } })).toEqual({
      allowed: false,
      reason: 'Write sans chemin de fichier ne se verifie pas',
    })
  })

  it('refuses broken json when a story is behind it', () => {
    expect(
      decideOnScopePayload('{ pas du json', { reference: 'FORGE-1', read: () => HELD, root: '/repo' })
        .allowed,
    ).toBe(false)
  })

  it('leaves broken json alone when no story is behind it', () => {
    expect(
      decideOnScopePayload('{ pas du json', { reference: null, read: () => HELD, root: '/repo' }).allowed,
    ).toBe(true)
  })
})

describe('a board it cannot read', () => {
  it('refuses the write rather than opening the gate', () => {
    const decision = decideOnScopePayload(
      JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/repo/backend/src/x.ts' } }),
      {
        reference: 'FORGE-1',
        read: () => {
          throw new Error('base illisible')
        },
        root: '/repo',
      },
    )

    expect(decision.allowed).toBe(false)
  })
})
