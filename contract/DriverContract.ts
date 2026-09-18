export const DRIVER_ABILITIES = ['stream', 'cost', 'resume', 'interrupt'] as const

export type DriverAbility = (typeof DRIVER_ABILITIES)[number]

export const DEGRADATIONS = [
  'threadWaitsForTheEnd',
  'costUnknown',
  'startsOver',
  'runsToTheEnd',
] as const

export type Degradation = (typeof DEGRADATIONS)[number]

export type DriverCard = {
  name: string
  abilities: readonly DriverAbility[]
}

export type DriverSheet = DriverCard & {
  degradations: readonly Degradation[]
}

const DEGRADATION_OF: Readonly<Record<DriverAbility, Degradation>> = {
  stream: 'threadWaitsForTheEnd',
  cost: 'costUnknown',
  resume: 'startsOver',
  interrupt: 'runsToTheEnd',
}

export function degradationsOf(card: DriverCard): readonly Degradation[] {
  return DRIVER_ABILITIES.filter((ability) => !card.abilities.includes(ability)).map(
    (ability) => DEGRADATION_OF[ability],
  )
}

export function driverNameOf(columnAgent: string | null): string | null {
  if (columnAgent === null) {
    return null
  }
  const [driver, agent] = columnAgent.split(':')
  return agent === undefined || driver === undefined || driver.trim() === '' ? null : driver.trim()
}

export function agentNameOf(columnAgent: string | null, fallback: string): string {
  if (columnAgent === null || columnAgent.trim() === '') {
    return fallback
  }
  const parts = columnAgent.split(':')
  const agent = (parts.length > 1 ? parts.slice(1).join(':') : parts[0]) ?? ''
  return agent.trim() === '' ? fallback : agent.trim()
}

export function sheetOfColumn(
  sheets: readonly DriverSheet[],
  columnAgent: string | null,
): DriverSheet | null {
  const wanted = driverNameOf(columnAgent)
  return (wanted === null ? sheets[0] : sheets.find((sheet) => sheet.name === wanted)) ?? null
}
