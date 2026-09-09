import { sampleOf, sumOf, type MetricSample } from '../../technical/Telemetry/PrometheusText.js'

export type MachineSnapshot = {
  cpuPercent: number | null
  memoryUsedMb: number | null
  memoryFreeMb: number | null
  diskPercent: number | null
  loadAverage: number | null
}

const BYTES_PER_MB = 1024 * 1024

const CPU = 'system_cpu_utilization_ratio'
const MEMORY = 'system_memory_usage_bytes'
const DISK = 'system_filesystem_usage_bytes'
const LOAD = 'system_cpu_load_average_1m'

function rounded(value: number, places: number): number {
  return Number(value.toFixed(places))
}

function megabytes(samples: readonly MetricSample[], state: string): number | null {
  const found = sampleOf(samples, MEMORY, { state })
  return found === null ? null : rounded(found.value / BYTES_PER_MB, 0)
}

function cpuPercentOf(samples: readonly MetricSample[]): number | null {
  const cores = samples.filter((sample) => sample.name === CPU)
  if (cores.length === 0) {
    return null
  }
  return rounded((sumOf(samples, CPU) / cores.length) * 100, 1)
}

function diskPercentOf(samples: readonly MetricSample[]): number | null {
  const total = sumOf(samples, DISK)
  const used = sampleOf(samples, DISK, { state: 'used' })
  if (total === 0 || used === null) {
    return null
  }
  return rounded((used.value / total) * 100, 1)
}

export function snapshotOf(samples: readonly MetricSample[]): MachineSnapshot {
  return {
    cpuPercent: cpuPercentOf(samples),
    memoryUsedMb: megabytes(samples, 'used'),
    memoryFreeMb: megabytes(samples, 'free'),
    diskPercent: diskPercentOf(samples),
    loadAverage: sampleOf(samples, LOAD)?.value ?? null,
  }
}
