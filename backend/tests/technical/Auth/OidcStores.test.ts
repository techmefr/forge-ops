import { describe, expect, it } from 'vitest'
import { createOidcHandoffs } from '../../../src/technical/Auth/OidcHandoffs.js'
import { createOidcTransactions } from '../../../src/technical/Auth/OidcTransactions.js'

const transaction = { provider: 'google', nonce: 'n', verifier: 'v', isDesktop: false, challenge: null }

describe('oidc transactions cap', () => {
  it('evicts the oldest transaction once the cap is reached', () => {
    const transactions = createOidcTransactions(() => 0, 3)
    const states = [1, 2, 3, 4].map(() => transactions.open(transaction))
    expect(transactions.take(states[0] as string)).toBeNull()
    expect(transactions.take(states[1] as string)).not.toBeNull()
    expect(transactions.take(states[3] as string)).not.toBeNull()
  })

  it('drops expired transactions before evicting live ones', () => {
    let now = 0
    const transactions = createOidcTransactions(() => now, 2)
    const old = transactions.open(transaction)
    now += 11 * 60 * 1000
    const fresh = transactions.open(transaction)
    const next = transactions.open(transaction)
    expect(transactions.take(old)).toBeNull()
    expect(transactions.take(fresh)).not.toBeNull()
    expect(transactions.take(next)).not.toBeNull()
  })

  it('refuses an expired transaction on take without sweeping', () => {
    let now = 0
    const transactions = createOidcTransactions(() => now)
    const state = transactions.open(transaction)
    now += 11 * 60 * 1000
    expect(transactions.take(state)).toBeNull()
  })

  it('keeps its size bounded under a flood', () => {
    const transactions = createOidcTransactions(() => 0, 100)
    const states = Array.from({ length: 1000 }, () => transactions.open(transaction))
    expect(states.filter((state) => transactions.take(state) !== null)).toHaveLength(100)
  })
})

describe('oidc handoffs cap', () => {
  it('evicts the oldest handoff once the cap is reached', () => {
    const handoffs = createOidcHandoffs<string>(() => 0, 3)
    const codes = ['a', 'b', 'c', 'd'].map((payload) => handoffs.put(payload))
    expect(handoffs.take(codes[0] as string)).toBeNull()
    expect(handoffs.take(codes[3] as string)).toBe('d')
  })

  it('refuses an expired handoff on take', () => {
    let now = 0
    const handoffs = createOidcHandoffs<string>(() => now)
    const code = handoffs.put('a')
    now += 61 * 1000
    expect(handoffs.take(code)).toBeNull()
  })
})
