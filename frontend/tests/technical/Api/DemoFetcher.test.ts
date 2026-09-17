import { describe, expect, it, vi } from 'vitest'
import { createDemoFetcher } from '@/technical/Api/DemoFetcher'

const SNAPSHOT = { '/api/board/kanban': [{ id: 1 }] }

describe('createDemoFetcher', () => {
  it('serves the frozen answer of a captured route', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT))
    const response = await fetcher('/api/board/kanban')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: 1 }])
  })

  it('loads the snapshot once whatever the number of calls', async () => {
    const load = vi.fn(() => Promise.resolve(SNAPSHOT))
    const fetcher = createDemoFetcher(load)

    await fetcher('/api/board/kanban')
    await fetcher('/api/board/kanban')

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('refuses to write, and says why', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT))
    const response = await fetcher('/api/stories/1/dispatch', { method: 'POST' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'DemonstrationFigee' })
  })

  it('never reaches the network for a write', async () => {
    const load = vi.fn(() => Promise.resolve(SNAPSHOT))
    await createDemoFetcher(load)('/api/stories/1/done', { method: 'POST' })

    expect(load).not.toHaveBeenCalled()
  })

  it('answers that a route is outside the visit rather than pretending it is empty', async () => {
    const fetcher = createDemoFetcher(() => Promise.resolve(SNAPSHOT))
    const response = await fetcher('/api/machine')

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'HorsVisite' })
  })
})
