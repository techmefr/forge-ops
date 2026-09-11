export type MachineSnapshot = {
  cpuPercent: number | null
  memoryUsedMb: number | null
  memoryFreeMb: number | null
  diskPercent: number | null
  loadAverage: number | null
}

export type MachineGauge = {
  name: string
  said: string
  percent: number | null
}

const MB_PER_GB = 1024
const NOTHING = '—'

function percentGauge(name: string, percent: number | null): MachineGauge {
  return {
    name,
    said: percent === null ? NOTHING : `${Math.round(percent)} %`,
    percent,
  }
}

function memoryGauge({ memoryUsedMb, memoryFreeMb }: MachineSnapshot): MachineGauge {
  if (memoryUsedMb === null || memoryFreeMb === null) {
    return { name: 'RAM', said: NOTHING, percent: null }
  }
  const total = memoryUsedMb + memoryFreeMb
  return {
    name: 'RAM',
    said: `${Math.round(memoryUsedMb / MB_PER_GB)} / ${Math.round(total / MB_PER_GB)} GO`,
    percent: total === 0 ? null : Number(((memoryUsedMb / total) * 100).toFixed(1)),
  }
}

export function gaugesOf(snapshot: MachineSnapshot | null): readonly MachineGauge[] {
  if (snapshot === null) {
    return []
  }
  return [
    percentGauge('CPU', snapshot.cpuPercent),
    memoryGauge(snapshot),
    percentGauge('DISQUE', snapshot.diskPercent),
  ]
}
