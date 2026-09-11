import { Hono } from 'hono'
import { parseExposition } from '../../technical/Telemetry/PrometheusText.js'
import { snapshotOf, type MachineSnapshot } from './MachineSnapshot.js'
import { readLocalMachine } from '../../technical/Machine/LocalMachine.js'

export type MachineSource = 'collector' | 'machine'

export type MachineApiInput = {
  metricsUrl: string | null
  fetchText?: (url: string) => Promise<string>
  readMachine?: () => Promise<MachineSnapshot>
}

async function readText(url: string): Promise<string> {
  const answer = await fetch(url)
  if (!answer.ok) {
    throw new Error(`le collecteur a repondu ${answer.status}`)
  }
  return answer.text()
}

function saidBy(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createMachineApi({
  metricsUrl,
  fetchText = readText,
  readMachine = () => readLocalMachine(process.cwd()),
}: MachineApiInput): Hono {
  const api = new Hono()

  api.get('/api/machine', async (context) => {
    if (metricsUrl === null) {
      try {
        return context.json({
          available: true,
          reason: null,
          source: 'machine',
          snapshot: await readMachine(),
        })
      } catch (error) {
        return context.json({
          available: false,
          reason: `la machine ne repond pas : ${saidBy(error)}`,
          source: 'machine',
          snapshot: null,
        })
      }
    }
    try {
      const snapshot = snapshotOf(parseExposition(await fetchText(metricsUrl)))
      return context.json({ available: true, reason: null, source: 'collector', snapshot })
    } catch (error) {
      return context.json({
        available: false,
        reason: `le collecteur ${metricsUrl} est injoignable : ${saidBy(error)}`,
        source: 'collector',
        snapshot: null,
      })
    }
  })

  return api
}
