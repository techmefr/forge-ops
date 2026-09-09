import { describe, expect, it } from 'vitest'
import { parseExposition, sampleOf, sumOf } from '../../../src/technical/Telemetry/PrometheusText.js'

const TEXT = `# HELP system_cpu_utilization_ratio the load
# TYPE system_cpu_utilization_ratio gauge
system_cpu_utilization_ratio{cpu="cpu0",state="user"} 0.21
system_cpu_utilization_ratio{cpu="cpu1",state="user"} 0.33
system_memory_usage_bytes{state="used"} 8589934592
system_memory_usage_bytes{state="free"} 4294967296
system_cpu_load_average_1m 1.75
`

describe('parseExposition', () => {
  it('reads every sample', () => {
    expect(parseExposition(TEXT)).toHaveLength(5)
  })

  it('drops the comments', () => {
    expect(parseExposition(TEXT).map((sample) => sample.name)).not.toContain('# HELP')
  })

  it('reads the name, the labels and the value', () => {
    expect(parseExposition(TEXT)[0]).toEqual({
      name: 'system_cpu_utilization_ratio',
      labels: { cpu: 'cpu0', state: 'user' },
      value: 0.21,
    })
  })

  it('reads a sample that carries no label', () => {
    expect(sampleOf(parseExposition(TEXT), 'system_cpu_load_average_1m')?.value).toBe(1.75)
  })

  it('drops a line whose value is not a number', () => {
    expect(parseExposition('thing{a="b"} nawak')).toEqual([])
  })

  it('drops a value the collector could not measure', () => {
    expect(parseExposition('thing +Inf\nthing_else NaN')).toEqual([])
  })

  it('drops a blank line', () => {
    expect(parseExposition('\n\n  \n')).toEqual([])
  })

  it('reads a timestamped line without mistaking the timestamp for the value', () => {
    expect(parseExposition('thing 42 1788971640630')[0]?.value).toBe(42)
  })

  it('rends nothing on an empty answer', () => {
    expect(parseExposition('')).toEqual([])
  })
})

describe('sampleOf', () => {
  it('finds a sample by name and label', () => {
    expect(
      sampleOf(parseExposition(TEXT), 'system_memory_usage_bytes', { state: 'free' })?.value,
    ).toBe(4294967296)
  })

  it('rends nothing when the label does not match', () => {
    expect(sampleOf(parseExposition(TEXT), 'system_memory_usage_bytes', { state: 'cache' })).toBeNull()
  })

  it('rends nothing when the name is unknown', () => {
    expect(sampleOf(parseExposition(TEXT), 'nothing_at_all')).toBeNull()
  })
})

describe('sumOf', () => {
  it('adds up the samples sharing a name', () => {
    expect(sumOf(parseExposition(TEXT), 'system_memory_usage_bytes')).toBe(12884901888)
  })

  it('rends zero when the name is unknown', () => {
    expect(sumOf(parseExposition(TEXT), 'nothing_at_all')).toBe(0)
  })
})
