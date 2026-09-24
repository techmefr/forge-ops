import { describe, expect, it } from 'vitest'
import {
  createDriverRegistry,
  createDrivenRunner,
  degradationsOf,
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
const codex = driver('codex', ['stream'])

function order(agentName = 'architecte'): LaunchOrder {
  return { storyId: 1, reference: 'FORGE-1', phase: 'spec', agentName, prompt: 'ecris' }
}

describe('what a driver promises', () => {
  it('asks nothing beyond launching a session', () => {
    expect(typeof codex.launch).toBe('function')
  })

  it('says what degrades when an ability is missing', () => {
    expect(degradationsOf(codex)).toEqual(['costUnknown', 'startsOver', 'runsToTheEnd'])
    expect(degradationsOf(claude)).toEqual([])
  })

  it('names one degradation per missing ability', () => {
    expect(degradationsOf(driver('half', ['stream', 'resume']))).toEqual([
      'costUnknown',
      'runsToTheEnd',
    ])
  })
})

describe('resolving a driver from the provider chosen at forge-card creation', () => {
  it('takes the driver the provider names', () => {
    const registry = createDriverRegistry([claude, codex])
    expect(registry.resolve('codex')).toBe(codex)
  })

  it('refuses a provider nobody registered', () => {
    const registry = createDriverRegistry([claude])
    expect(registry.resolve('codex')).toEqual({ refusal: 'UnknownDriver', name: 'codex' })
  })
})

describe('the runner the rest of the system sees', () => {
  it('launches through the driver the forge card provider names, not the column', async () => {
    launched.length = 0
    const runner = createDrivenRunner({
      drivers: [claude, codex],
      providerOf: () => 'codex',
      columnAgentOf: () => 'trinity',
    })
    expect(await runner.launch(order())).toEqual({ claudeSessionId: 'codex-1' })
    expect(launched[0]?.agentName).toBe('trinity')
  })

  it('keeps the phase agent when the column declares nothing', async () => {
    launched.length = 0
    const runner = createDrivenRunner({ drivers: [claude], providerOf: () => 'claude', columnAgentOf: () => null })
    await runner.launch(order('galadriel'))
    expect(launched[0]?.agentName).toBe('galadriel')
  })

  it('refuses to launch on a provider nobody registered', () => {
    const runner = createDrivenRunner({ drivers: [claude], providerOf: () => 'codex', columnAgentOf: () => null })
    expect(() => runner.launch(order())).toThrow(UnknownDriverError)
  })

  it('picks the same driver across every column, since the provider is fixed per card', async () => {
    launched.length = 0
    const runner = createDrivenRunner({
      drivers: [claude, codex],
      providerOf: () => 'codex',
      columnAgentOf: (order) => (order.phase === 'spec' ? 'architecte' : 'trinity'),
    })
    await runner.launch(order())
    await runner.launch({ ...order(), phase: 'code' })
    expect(launched.map((entry) => entry.agentName)).toEqual(['architecte', 'trinity'])
  })
})
