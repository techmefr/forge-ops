import { describe, expect, it } from 'vitest'
import { decideOnWrite } from '../../../src/domain/Foremerge/ScopeGuard.js'
import type { ScopeReservation } from '../../../src/domain/Foremerge/ForemergeRepository.js'

function held(storyReference: string, pathPrefix: string, symbols: readonly string[] = []): ScopeReservation {
  return {
    id: 1,
    storyId: storyReference === 'FORGE-1' ? 1 : 2,
    storyReference,
    pathPrefix,
    symbols,
    reservedAt: '2026-09-09 18:00:00',
  }
}

const MINE = held('FORGE-1', 'backend/src/domain/Mail')
const THEIRS = held('FORGE-2', 'frontend/src/domain/Mail')

describe('a story that reserved nothing', () => {
  it('writes where it wants, the board never asked it to declare', () => {
    expect(decideOnWrite({ reservations: [], reference: 'FORGE-1', path: 'backend/src/x.ts' })).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('still cannot write inside what another story reserved', () => {
    const decision = decideOnWrite({
      reservations: [THEIRS],
      reference: 'FORGE-1',
      path: 'frontend/src/domain/Mail/MailList.vue',
    })

    expect(decision.allowed).toBe(false)
  })

  it('says who holds the ground it refused', () => {
    const decision = decideOnWrite({
      reservations: [THEIRS],
      reference: 'FORGE-1',
      path: 'frontend/src/domain/Mail/MailList.vue',
    })

    expect(decision.reason).toContain('FORGE-2')
  })
})

describe('a story that reserved a folder', () => {
  it('writes inside it', () => {
    expect(
      decideOnWrite({
        reservations: [MINE],
        reference: 'FORGE-1',
        path: 'backend/src/domain/Mail/MailRepository.ts',
      }).allowed,
    ).toBe(true)
  })

  it('writes the folder itself', () => {
    expect(
      decideOnWrite({ reservations: [MINE], reference: 'FORGE-1', path: 'backend/src/domain/Mail' })
        .allowed,
    ).toBe(true)
  })

  it('is refused outside it, that is the point of declaring', () => {
    expect(
      decideOnWrite({ reservations: [MINE], reference: 'FORGE-1', path: 'backend/src/domain/Zone/Zone.ts' })
        .allowed,
    ).toBe(false)
  })

  it('is not fooled by a folder that merely starts with the same letters', () => {
    expect(
      decideOnWrite({
        reservations: [MINE],
        reference: 'FORGE-1',
        path: 'backend/src/domain/Mailbox/Mailbox.ts',
      }).allowed,
    ).toBe(false)
  })

  it('is not fooled by a windows separator', () => {
    expect(
      decideOnWrite({
        reservations: [MINE],
        reference: 'FORGE-1',
        path: 'backend\\src\\domain\\Mail\\MailRepository.ts',
      }).allowed,
    ).toBe(true)
  })

  it('is not fooled by a climb back out', () => {
    expect(
      decideOnWrite({
        reservations: [MINE],
        reference: 'FORGE-1',
        path: 'backend/src/domain/Mail/../Zone/Zone.ts',
      }).allowed,
    ).toBe(false)
  })

  it('says what it reserved when it refuses', () => {
    const decision = decideOnWrite({
      reservations: [MINE],
      reference: 'FORGE-1',
      path: 'backend/src/domain/Zone/Zone.ts',
    })

    expect(decision.reason).toContain('backend/src/domain/Mail')
  })

  it('writes in any of its several reservations', () => {
    const decision = decideOnWrite({
      reservations: [MINE, held('FORGE-1', 'backend/tests/domain/Mail')],
      reference: 'FORGE-1',
      path: 'backend/tests/domain/Mail/MailRepository.test.ts',
    })

    expect(decision.allowed).toBe(true)
  })
})

describe('a write with no story behind it', () => {
  it('is allowed even inside a reserved folder, a human at the board is not an agent', () => {
    const decision = decideOnWrite({
      reservations: [MINE, THEIRS],
      reference: null,
      path: 'frontend/src/domain/Mail/MailList.vue',
    })

    expect(decision.allowed).toBe(true)
  })
})
