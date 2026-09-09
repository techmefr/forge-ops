import { describe, expect, it } from 'vitest'
import { createMachineApi } from '../../../src/domain/Resource/MachineApi.js'

const TEXT = `system_cpu_utilization_ratio{cpu="cpu0",state="user"} 0.5
system_memory_usage_bytes{state="used"} 1048576
`

function ask(input: Parameters<typeof createMachineApi>[0]): Promise<Response> {
  return createMachineApi(input).request('/api/machine') as Promise<Response>
}

describe('GET /api/machine', () => {
  it('says the metrics are unavailable when no collector is configured', async () => {
    const response = await ask({ metricsUrl: null })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: false })
  })

  it('says why, so nobody hunts a bug that is not there', async () => {
    const response = await ask({ metricsUrl: null })

    await expect(response.json()).resolves.toMatchObject({
      reason: expect.stringContaining('FORGE_OTEL_METRICS_URL'),
    })
  })

  it('reads the collector when there is one', async () => {
    const response = await ask({
      metricsUrl: 'http://127.0.0.1:8889/metrics',
      fetchText: () => Promise.resolve(TEXT),
    })

    await expect(response.json()).resolves.toMatchObject({
      available: true,
      snapshot: { cpuPercent: 50, memoryUsedMb: 1 },
    })
  })

  it('asks the collector at the address it was given', async () => {
    const asked: string[] = []
    await ask({
      metricsUrl: 'http://127.0.0.1:8889/metrics',
      fetchText: (url) => {
        asked.push(url)
        return Promise.resolve(TEXT)
      },
    })

    expect(asked).toEqual(['http://127.0.0.1:8889/metrics'])
  })

  it('says the collector is unreachable rather than inventing figures', async () => {
    const response = await ask({
      metricsUrl: 'http://127.0.0.1:8889/metrics',
      fetchText: () => Promise.reject(new Error('connexion refusee')),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining('connexion refusee'),
    })
  })

  it('rends an empty snapshot when the collector answers nothing useful', async () => {
    const response = await ask({
      metricsUrl: 'http://127.0.0.1:8889/metrics',
      fetchText: () => Promise.resolve('# rien\n'),
    })

    await expect(response.json()).resolves.toMatchObject({
      available: true,
      snapshot: { cpuPercent: null },
    })
  })
})
