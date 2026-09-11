import { phrase, type Phrase } from '@/technical/Language/Phrase'

export type MachineSnapshot = {
  cpuPercent: number | null
  memoryUsedMb: number | null
  memoryFreeMb: number | null
  diskPercent: number | null
  loadAverage: number | null
}

export type MachineGauge = {
  nameKey: string
  glyph: string
  said: Phrase
  percent: number | null
}

const MB_PER_GB = 1024

function percentGauge(nameKey: string, glyph: string, percent: number | null): MachineGauge {
  return {
    nameKey,
    glyph,
    said: percent === null ? phrase('common.nothing') : phrase('common.percent', { value: Math.round(percent) }),
    percent,
  }
}

function memoryGauge({ memoryUsedMb, memoryFreeMb }: MachineSnapshot): MachineGauge {
  if (memoryUsedMb === null || memoryFreeMb === null) {
    return { nameKey: 'machine.ram', glyph: 'ram', said: phrase('common.nothing'), percent: null }
  }
  const total = memoryUsedMb + memoryFreeMb
  return {
    nameKey: 'machine.ram',
    glyph: 'ram',
    said: phrase('machine.gigabytes', {
      used: Math.round(memoryUsedMb / MB_PER_GB),
      total: Math.round(total / MB_PER_GB),
    }),
    percent: total === 0 ? null : Number(((memoryUsedMb / total) * 100).toFixed(1)),
  }
}

export function gaugesOf(snapshot: MachineSnapshot | null): readonly MachineGauge[] {
  if (snapshot === null) {
    return []
  }
  return [
    percentGauge('machine.cpu', 'cpu', snapshot.cpuPercent),
    memoryGauge(snapshot),
    percentGauge('machine.disk', 'disk', snapshot.diskPercent),
  ]
}
