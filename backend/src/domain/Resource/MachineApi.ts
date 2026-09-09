import { Hono } from 'hono'
import { parseExposition } from '../../technical/Telemetry/PrometheusText.js'
import { snapshotOf } from './MachineSnapshot.js'

export const NO_COLLECTOR =
  "aucun collecteur OpenTelemetry n est declare, renseigne FORGE_OTEL_METRICS_URL pour lire la machine"

export type MachineApiInput = {
  metricsUrl: string | null
  fetchText?: (url: string) => Promise<string>
}

async function readText(url: string): Promise<string> {
  const answer = await fetch(url)
  if (!answer.ok) {
    throw new Error(`le collecteur a repondu ${answer.status}`)
  }
  return answer.text()
}

export function createMachineApi({ metricsUrl, fetchText = readText }: MachineApiInput): Hono {
  const api = new Hono()

  api.get('/api/machine', async (context) => {
    if (metricsUrl === null) {
      return context.json({ available: false, reason: NO_COLLECTOR, snapshot: null })
    }
    try {
      const snapshot = snapshotOf(parseExposition(await fetchText(metricsUrl)))
      return context.json({ available: true, reason: null, snapshot })
    } catch (error) {
      return context.json({
        available: false,
        reason: `le collecteur ${metricsUrl} est injoignable : ${
          error instanceof Error ? error.message : String(error)
        }`,
        snapshot: null,
      })
    }
  })

  return api
}
