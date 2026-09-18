import type { LaunchOrder, SessionRunner } from '../Dispatch/Dispatch.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import type { TemplateColumn } from '../../../../contract/BoardContract.js'
import {
  agentNameOf,
  driverNameOf,
  type DriverCard,
} from '../../../../contract/DriverContract.js'

export {
  agentNameOf,
  degradationsOf,
  driverNameOf,
  DRIVER_ABILITIES,
  DEGRADATIONS,
} from '../../../../contract/DriverContract.js'
export type { Degradation, DriverAbility, DriverCard } from '../../../../contract/DriverContract.js'

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

export type AgentDriver = DriverCard & SessionRunner

export type DriverRefusal = { refusal: 'UnknownDriver'; name: string }

export function pickDriver(
  drivers: readonly AgentDriver[],
  columnAgent: string | null,
): AgentDriver | DriverRefusal {
  const first = drivers[0]
  if (first === undefined) {
    return { refusal: 'UnknownDriver', name: driverNameOf(columnAgent) ?? '' }
  }
  const wanted = driverNameOf(columnAgent)
  if (wanted === null) {
    return first
  }
  return drivers.find((driver) => driver.name === wanted) ?? { refusal: 'UnknownDriver', name: wanted }
}

export class UnknownDriverError extends Error {
  constructor(public readonly driverName: string) {
    super(`aucun pilote ne repond au nom de ${driverName}`)
    this.name = 'UnknownDriverError'
  }
}

export type DrivenRunnerInput = {
  drivers: readonly AgentDriver[]
  columnAgentOf: (order: LaunchOrder) => string | null
}

export function createDrivenRunner({ drivers, columnAgentOf }: DrivenRunnerInput): SessionRunner {
  return {
    launch: (order) => {
      const columnAgent = columnAgentOf(order)
      const chosen = pickDriver(drivers, columnAgent)
      if ('refusal' in chosen) {
        throw new UnknownDriverError(chosen.name)
      }
      return chosen.launch({ ...order, agentName: agentNameOf(columnAgent, order.agentName) })
    },
  }
}
