import { describe, expect, it } from 'vitest'
import {
  createLoginRateLimit,
  LOGIN_ATTEMPT_CAP,
  LOGIN_WINDOW_MS,
} from '../../../src/technical/Auth/LoginRateLimit.js'

function exhaust(limit: ReturnType<typeof createLoginRateLimit>, key: string, times: number): void {
  for (let attempt = 0; attempt < times; attempt += 1) {
    limit.recordFailure(key)
  }
}

describe('createLoginRateLimit', () => {
  it('lets a fresh caller through', () => {
    const limit = createLoginRateLimit()

    expect(limit.refuses('gaetan')).toBe(false)
  })

  it('still lets through a caller who has failed less than the cap', () => {
    const limit = createLoginRateLimit()

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP - 1)

    expect(limit.refuses('gaetan')).toBe(false)
  })

  it('refuses a caller who has burnt the whole allowance', () => {
    const limit = createLoginRateLimit()

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP)

    expect(limit.refuses('gaetan')).toBe(true)
  })

  it('holds the refusal against that caller only', () => {
    const limit = createLoginRateLimit()

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP)

    expect(limit.refuses('jeremy')).toBe(false)
  })

  it('forgives the caller once the window has passed, so nobody stays locked out', () => {
    let now = 1_000
    const limit = createLoginRateLimit({ clock: () => now })

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP)
    now = 1_000 + LOGIN_WINDOW_MS + 1

    expect(limit.refuses('gaetan')).toBe(false)
  })

  it('forgets a caller who finally signs in', () => {
    const limit = createLoginRateLimit()

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP)
    limit.forget('gaetan')

    expect(limit.refuses('gaetan')).toBe(false)
  })

  it('says how long the caller must wait', () => {
    let now = 1_000
    const limit = createLoginRateLimit({ clock: () => now })

    exhaust(limit, 'gaetan', LOGIN_ATTEMPT_CAP)
    now = 1_000 + 10_000

    expect(limit.retryAfterMs('gaetan')).toBe(LOGIN_WINDOW_MS - 10_000)
  })

  it('asks nobody to wait when it is not refusing', () => {
    const limit = createLoginRateLimit()

    expect(limit.retryAfterMs('gaetan')).toBe(0)
  })

  it('stays bounded, dropping the oldest caller once the cap of tracked callers is reached', () => {
    const limit = createLoginRateLimit({ cap: 2 })

    limit.recordFailure('un')
    limit.recordFailure('deux')
    limit.recordFailure('trois')

    expect(limit.count()).toBe(2)
  })

  it('reclaims stale callers instead of counting them against the cap', () => {
    let now = 1_000
    const limit = createLoginRateLimit({ cap: 4, clock: () => now })

    limit.recordFailure('un')
    limit.recordFailure('deux')
    now = 1_000 + LOGIN_WINDOW_MS + 1
    limit.recordFailure('trois')

    expect(limit.count()).toBe(1)
  })
})
