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

export function sheetOfProvider(sheets: readonly DriverSheet[], provider: string): DriverSheet | null {
  return sheets.find((sheet) => sheet.name === provider) ?? null
}
