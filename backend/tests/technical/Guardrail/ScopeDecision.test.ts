import { describe, expect, it } from 'vitest'
import {
  decideOnScopePayload,
  decideOnWriteToolCall,
  WRITING_TOOLS,
} from '../../../src/technical/Guardrail/ScopeDecision.js'
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

describe('a write that leaves the checkout', () => {
  it('refuses an absolute path outside the root as leaving the checkout', () => {
    const decision = ask({ tool_name: 'Write', tool_input: { file_path: '/etc/passwd' } })

    expect(decision).toEqual({
      allowed: false,
      reason: '/etc/passwd est hors du depot, ce hook ne laisse rien sortir du perimetre',
    })
  })

  it('says the path is outside the checkout', () => {
    const decision = ask({ tool_name: 'Write', tool_input: { file_path: '/etc/passwd' } })

    expect(decision.reason).toContain('hors du depot')
  })

  it('refuses a relative path that climbs above the root', () => {
    const decision = ask({ tool_name: 'Edit', tool_input: { file_path: '../../etc/passwd' } })

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('hors du depot')
  })

  it('refuses a path that climbs out and back in, the walk lands outside on the way', () => {
    const decision = ask({
      tool_name: 'Write',
      tool_input: { file_path: '/repo/backend/src/domain/Mail/../../../../../etc/passwd' },
    })

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('hors du depot')
  })

  it('refuses it even when no story is behind the write', () => {
    expect(ask({ tool_name: 'Write', tool_input: { file_path: '/etc/passwd' } }, null).allowed).toBe(false)
  })
})

describe('a write whose holder is unknown', () => {
  it('is refused on ground another story reserved', () => {
    const decision = ask(
      { tool_name: 'Write', tool_input: { file_path: '/repo/backend/src/domain/Mail/Mail.ts' } },
      null,
    )

    expect(decision.allowed).toBe(false)
  })
})

describe('the lease of the story behind the write', () => {
  it('is renewed every time the hook reads the board', () => {
    const renewed: number[] = []

    decideOnWriteToolCall(
      JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: '/repo/backend/src/domain/Mail/Mail.ts' },
      }),
      {
        reference: 'FORGE-1',
        read: () => HELD,
        renew: (storyId) => renewed.push(storyId),
        root: '/repo',
        phase: 'code',
      },
    )

    expect(renewed).toEqual([1])
  })

  it('is left alone when the write belongs to no story', () => {
    const renewed: number[] = []

    decideOnWriteToolCall(
      JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: '/repo/backend/src/domain/Zone/Zone.ts' },
      }),
      {
        reference: null,
        read: () => HELD,
        renew: (storyId) => renewed.push(storyId),
        root: '/repo',
        phase: 'code',
      },
    )

    expect(renewed).toEqual([])
  })

  it('is renewed even when the write is refused, the session is alive either way', () => {
    const renewed: number[] = []

    const decision = decideOnWriteToolCall(
      JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: '/repo/backend/src/domain/Zone/Zone.ts' },
      }),
      {
        reference: 'FORGE-1',
        read: () => HELD,
        renew: (storyId) => renewed.push(storyId),
        root: '/repo',
        phase: 'code',
      },
    )

    expect(decision.allowed).toBe(false)
    expect(renewed).toEqual([1])
  })
})

describe('the phase policy on a write tool', () => {
  function askInPhase(phase: string | null, tool = 'Write') {
    return decideOnWriteToolCall(
      JSON.stringify({ tool_name: tool, tool_input: { file_path: '/repo/backend/src/domain/Mail/M.ts' } }),
      { reference: 'FORGE-1', read: () => HELD, renew: () => undefined, root: '/repo', phase },
    )
  }

  it('lets a write through in a phase that writes', () => {
    expect(askInPhase('code').allowed).toBe(true)
  })

  it('refuses a write in review, which only reads and runs', () => {
    expect(askInPhase('review').allowed).toBe(false)
  })

  it('names the phase and the tool it refused', () => {
    expect(askInPhase('spec').reason).toContain('Write')
  })

  it('refuses a write when no phase is declared', () => {
    expect(askInPhase(null).allowed).toBe(false)
  })

  it('refuses a write in a phase nobody declared', () => {
    expect(askInPhase('vacances').allowed).toBe(false)
  })

  it('refuses a payload it cannot parse, phase or not', () => {
    expect(
      decideOnWriteToolCall('{ pas du json', {
        reference: null,
        read: () => HELD,
        renew: () => undefined,
        root: '/repo',
        phase: 'code',
      }).allowed,
    ).toBe(false)
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
