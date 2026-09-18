import { describe, expect, it } from 'vitest'
import {
  agentNameOf,
  createDrivenRunner,
  degradationsOf,
  driverNameOf,
  pickDriver,
  UnknownDriverError,
} from '../../../src/domain/Driver/Driver.js'
import type { AgentDriver } from '../../../src/domain/Driver/Driver.js'
import type { LaunchOrder } from '../../../src/domain/Dispatch/Dispatch.js'

const launched: LaunchOrder[] = []

function driver(name: string, abilities: AgentDriver['abilities']): AgentDriver {
  return {
    name,
    abilities,
    launch: (order) => {
      launched.push(order)
      return Promise.resolve({ claudeSessionId: `${name}-1` })
    },
  }
}

const claude = driver('claude', ['stream', 'cost', 'resume', 'interrupt'])
const blunt = driver('blunt', [])

function order(agentName = 'architecte'): LaunchOrder {
  return { storyId: 1, reference: 'FORGE-1', phase: 'spec', agentName, prompt: 'ecris' }
}

describe('what a driver promises', () => {
  it('asks nothing beyond launching a session', () => {
    expect(typeof blunt.launch).toBe('function')
  })

  it('says what degrades when an ability is missing', () => {
    expect(degradationsOf(blunt)).toEqual([
      'threadWaitsForTheEnd',
      'costUnknown',
      'startsOver',
      'runsToTheEnd',
    ])
    expect(degradationsOf(claude)).toEqual([])
  })

  it('names one degradation per missing ability', () => {
    expect(degradationsOf(driver('half', ['stream', 'resume']))).toEqual([
      'costUnknown',
      'runsToTheEnd',
    ])
  })
})

describe('reading the agent a column declares', () => {
  it('reads the driver before the colon', () => {
    expect(driverNameOf('codex:architecte')).toBe('codex')
    expect(agentNameOf('codex:architecte', 'elrond')).toBe('architecte')
  })

  it('leaves the driver open when the column names an agent alone', () => {
    expect(driverNameOf('architecte')).toBeNull()
    expect(agentNameOf('architecte', 'elrond')).toBe('architecte')
  })

  it('keeps the phase agent when the column declares nothing', () => {
    expect(driverNameOf(null)).toBeNull()
    expect(agentNameOf(null, 'elrond')).toBe('elrond')
    expect(agentNameOf('  ', 'elrond')).toBe('elrond')
  })
})

describe('picking the driver of a column', () => {
  it('takes the one the column names', () => {
    expect(pickDriver([claude, blunt], 'blunt:trinity')).toBe(blunt)
  })

  it('falls back to the first when the column names none', () => {
    expect(pickDriver([claude, blunt], null)).toBe(claude)
  })

  it('refuses a driver nobody registered', () => {
    expect(pickDriver([claude], 'codex:architecte')).toEqual({
      refusal: 'UnknownDriver',
      name: 'codex',
    })
  })
})

describe('the runner the rest of the system sees', () => {
  it('launches through the driver the column declares', async () => {
    launched.length = 0
    const runner = createDrivenRunner({
      drivers: [claude, blunt],
      columnAgentOf: () => 'blunt:trinity',
    })
    expect(await runner.launch(order())).toEqual({ claudeSessionId: 'blunt-1' })
    expect(launched[0]?.agentName).toBe('trinity')
  })

  it('keeps the phase agent when the column declares nothing', async () => {
    launched.length = 0
    const runner = createDrivenRunner({ drivers: [claude], columnAgentOf: () => null })
    await runner.launch(order('galadriel'))
    expect(launched[0]?.agentName).toBe('galadriel')
  })

  it('refuses to launch on a driver nobody registered', () => {
    const runner = createDrivenRunner({ drivers: [claude], columnAgentOf: () => 'codex:a' })
    expect(() => runner.launch(order())).toThrow(UnknownDriverError)
  })
})
