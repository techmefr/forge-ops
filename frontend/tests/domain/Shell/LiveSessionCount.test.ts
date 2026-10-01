import { describe, expect, it } from 'vitest'
import type { MachineReading } from '@/domain/Board/BoardModel'
import { liveSessionCount } from '@/domain/Shell/UseFleet'

function reading(running: number | null): MachineReading {
  return {
    available: true,
    reason: null,
    snapshot: null,
    sessions: running === null ? null : { running, cap: 5 },
  }
}

describe('liveSessionCount', () => {
  it('counts the live forge sessions, including an agent that waits for the human', () => {
    expect(liveSessionCount(reading(2), 0)).toBe(2)
  })

  it('falls back to the working jobs when the machine does not report sessions', () => {
    expect(liveSessionCount(reading(null), 3)).toBe(3)
    expect(liveSessionCount(null, 1)).toBe(1)
  })
})
