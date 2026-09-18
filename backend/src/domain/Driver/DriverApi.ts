import { Hono } from 'hono'
import type { AgentDriver } from './Driver.js'
import { degradationsOf } from '../../../../contract/DriverContract.js'

export type DriverApiInput = {
  drivers: readonly AgentDriver[]
}

export function createDriverApi({ drivers }: DriverApiInput): Hono {
  const api = new Hono()

  api.get('/api/drivers', (context) =>
    context.json(
      drivers.map((driver) => ({
        name: driver.name,
        abilities: driver.abilities,
        degradations: degradationsOf(driver),
      })),
    ),
  )

  return api
}
