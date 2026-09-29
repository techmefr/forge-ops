import { describe, expect, it, vi } from 'vitest'
import { createDemoFetcher } from '@/technical/Api/DemoFetcher'
import type { DemoEnvironment } from '@/technical/Api/Demo/DemoModel'

const SNAPSHOT = { '/api/board/kanban': [{ id: 1 }], '/api/incidents': [{ id: 1, state: 'pending' }, { id: 2, state: 'accepted' }] }

const ENVIRONMENT: DemoEnvironment = { emit: () => undefined, later: () => undefined, now: () => new Date('2026-09-29T10:00:00') }

describe('createDemoFetcher', () => {
  it('serves the frozen answer of a captured route', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT), ENVIRONMENT)
    const response = await fetcher('/api/board/kanban')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 1 }])
  })

  it('loads the snapshot once whatever the number of calls', async () => {
    const load = vi.fn(() => Promise.resolve(SNAPSHOT))
    const fetcher = createDemoFetcher(load, ENVIRONMENT)

    await fetcher('/api/board/kanban')
    await fetcher('/api/board/kanban')

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('refuses a write it cannot simulate, and says why', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT), ENVIRONMENT)
    const response = await fetcher('/api/stories/1/dispatch', { method: 'POST' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'DemonstrationFigee' })
  })

  it('filters a captured list by the query string of the route', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT), ENVIRONMENT)
    const response = await fetcher('/api/incidents?state=pending')

    await expect(response.json()).resolves.toEqual([{ id: 1, state: 'pending' }])
  })

  it('answers that a route is outside the visit rather than pretending it is empty', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT), ENVIRONMENT)
    const response = await fetcher('/api/machine')

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'HorsVisite' })
  })
})
