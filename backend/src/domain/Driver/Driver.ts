import type { LaunchOrder, SessionRunner } from '../Dispatch/Dispatch.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import type { TemplateColumn } from '../../../../contract/BoardContract.js'
import type { DriverAbility } from '../../../../contract/DriverContract.js'

export { degradationsOf, DRIVER_ABILITIES, DEGRADATIONS, sheetOfProvider } from '../../../../contract/DriverContract.js'
export type { Degradation, DriverAbility, DriverCard, DriverSheet } from '../../../../contract/DriverContract.js'

export const COLUMN_OF_PHASE: Readonly<Record<AgentPhase, string>> = {
  spec: 'backlog',
  architecture: 'architecture',
  tdd: 'building',
  code: 'building',
  gate: 'gating',
  review: 'reviewing',
  ship: 'shipping',
}

export function columnAgentOfPhase(
  columns: readonly TemplateColumn[],
  phase: AgentPhase,
): string | null {
  const wanted = COLUMN_OF_PHASE[phase]
  return columns.find((column) => column.state === wanted)?.agent ?? null
}

export type AgentDriver = {
  name: string
  abilities: readonly DriverAbility[]
} & SessionRunner

export type DriverRefusal = { refusal: 'UnknownDriver'; name: string }

export type DriverRegistry = {
  resolve: (provider: string) => AgentDriver | DriverRefusal
}

export function createDriverRegistry(drivers: readonly AgentDriver[]): DriverRegistry {
  return {
    resolve: (provider) => drivers.find((driver) => driver.name === provider) ?? { refusal: 'UnknownDriver', name: provider },
  }
}

export class UnknownDriverError extends Error {
  constructor(public readonly driverName: string) {
    super(`aucun pilote ne repond au nom de ${driverName}`)
    this.name = 'UnknownDriverError'
  }
}

export type DrivenRunnerInput = {
  drivers: readonly AgentDriver[]
  providerOf: (order: LaunchOrder) => string
  columnAgentOf: (order: LaunchOrder) => string | null
}

export function createDrivenRunner({ drivers, providerOf, columnAgentOf }: DrivenRunnerInput): SessionRunner {
  const registry = createDriverRegistry(drivers)
  return {
    launch: (order) => {
      const chosen = registry.resolve(providerOf(order))
      if ('refusal' in chosen) {
        throw new UnknownDriverError(chosen.name)
      }
      const columnAgent = columnAgentOf(order)
      const agentName = columnAgent === null || columnAgent.trim() === '' ? order.agentName : columnAgent.trim()
      return chosen.launch({ ...order, agentName })
    },
  }
}
