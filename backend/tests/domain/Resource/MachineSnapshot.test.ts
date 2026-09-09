import { describe, expect, it } from 'vitest'
import { snapshotOf } from '../../../src/domain/Resource/MachineSnapshot.js'
import { parseExposition } from '../../../src/technical/Telemetry/PrometheusText.js'

const FULL = `system_cpu_utilization_ratio{cpu="cpu0",state="user"} 0.20
system_cpu_utilization_ratio{cpu="cpu1",state="user"} 0.40
system_memory_usage_bytes{state="used"} 8589934592
system_memory_usage_bytes{state="free"} 4294967296
system_filesystem_usage_bytes{state="used"} 100000000000
system_filesystem_usage_bytes{state="free"} 100000000000
system_cpu_load_average_1m 1.5
`

function snapshot(text: string) {
  return snapshotOf(parseExposition(text))
}

describe('a collector that answers everything', () => {
  it('averages the cpu utilisation across the cores', () => {
    expect(snapshot(FULL).cpuPercent).toBe(30)
  })

  it('rends the memory in megabytes, the board does not count bytes', () => {
    expect(snapshot(FULL).memoryUsedMb).toBe(8192)
  })

  it('rends how much memory is left', () => {
    expect(snapshot(FULL).memoryFreeMb).toBe(4096)
  })

  it('rends the share of the disk in use', () => {
    expect(snapshot(FULL).diskPercent).toBe(50)
  })

  it('rends the load average as the collector gave it', () => {
    expect(snapshot(FULL).loadAverage).toBe(1.5)
  })
})

describe('a collector that answers half of it', () => {
  it('rends nothing for a metric it never saw', () => {
    expect(snapshot('system_cpu_load_average_1m 2').cpuPercent).toBeNull()
  })

  it('still rends what it did see', () => {
    expect(snapshot('system_cpu_load_average_1m 2').loadAverage).toBe(2)
  })

  it('does not divide by zero on a memory with no total', () => {
    expect(snapshot('system_memory_usage_bytes{state="used"} 0').memoryUsedMb).toBe(0)
  })

  it('rends nothing for a disk with no total', () => {
    expect(snapshot('system_cpu_load_average_1m 2').diskPercent).toBeNull()
  })
})

describe('a collector that says nothing', () => {
  it('rends an empty snapshot rather than invented figures', () => {
    expect(snapshot('')).toEqual({
      cpuPercent: null,
      memoryUsedMb: null,
      memoryFreeMb: null,
      diskPercent: null,
      loadAverage: null,
    })
  })
})
