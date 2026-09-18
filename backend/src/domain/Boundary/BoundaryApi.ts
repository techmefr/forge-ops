import { Hono } from 'hono'
import { CONTRACT_VERSION, INSTANCE_HELD, SERVER_HELD, announcementOf } from './Boundary.js'
import type { OutboxRepository } from './OutboxRepository.js'

export type BoundaryApiInput = {
  outbox: OutboxRepository
  installedVersion: string
  offeredVersion: () => string
}

export function createBoundaryApi({
  outbox,
  installedVersion,
  offeredVersion,
}: BoundaryApiInput): Hono {
  const api = new Hono()

  api.get('/api/boundary', (context) =>
    context.json({
      contractVersion: CONTRACT_VERSION,
      serverHolds: SERVER_HELD,
      instanceHolds: INSTANCE_HELD,
      owed: outbox.depth(),
      announcement: announcementOf(installedVersion, offeredVersion()),
    }),
  )

  return api
}
