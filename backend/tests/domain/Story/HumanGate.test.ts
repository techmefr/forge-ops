import { describe, expect, it } from 'vitest'
import {
  GATE_DEADLINE_MINUTES,
  HUMAN_GATE_STATES,
  overdueGates,
  statusOfWaits,
  type HumanGateWait,
} from '../../../src/domain/Story/HumanGate.js'

const HOUR = 3600

function waiting(seconds: number, over: Partial<HumanGateWait> = {}): HumanGateWait {
  return {
    storyId: 7,
    reference: 'FORGE-7',
    state: 'shipping',
    waitingSince: '2026-09-10 09:00:00',
    waitingSeconds: seconds,
    ...over,
  }
}

describe('the deadline on a door a human has to open', () => {
  it('gives the human a full working day', () => {
    expect(GATE_DEADLINE_MINUTES).toBe(24 * 60)
  })

  it('watches the three states where the pipeline stops on a person', () => {
    expect([...HUMAN_GATE_STATES]).toEqual(['plan_review', 'shipping', 'escalated'])
  })

  it('leaves a gate alone while the deadline has not passed', () => {
    expect(statusOfWaits([waiting(23 * HOUR)])[0]?.overdue).toBe(false)
  })

  it('calls a gate overdue once the deadline has passed', () => {
    expect(statusOfWaits([waiting(25 * HOUR)])[0]?.overdue).toBe(true)
  })

  it('keeps the story exactly where it was', () => {
    expect(statusOfWaits([waiting(72 * HOUR)])[0]?.state).toBe('shipping')
  })

  it('says how long the wait has been so the board can rank it', () => {
    expect(statusOfWaits([waiting(48 * HOUR)])[0]?.waitingHours).toBe(48)
  })

  it('names the story and the door in the statement it hands the board', () => {
    const statement = statusOfWaits([waiting(30 * HOUR, { reference: 'FORGE-3' })])[0]?.statement

    expect(statement).toContain('FORGE-3')
    expect(statement).toContain('shipping')
  })

  it('keeps only the gates past their deadline when asked for the overdue ones', () => {
    const gates = overdueGates([
      waiting(2 * HOUR, { storyId: 1, reference: 'FORGE-1' }),
      waiting(40 * HOUR, { storyId: 2, reference: 'FORGE-2' }),
    ])

    expect(gates.map((gate) => gate.reference)).toEqual(['FORGE-2'])
  })

  it('accepts a shorter deadline so an impatient team can set its own', () => {
    expect(statusOfWaits([waiting(2 * HOUR)], 60)[0]?.overdue).toBe(true)
  })
})
