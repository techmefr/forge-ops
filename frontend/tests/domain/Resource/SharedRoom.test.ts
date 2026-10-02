import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import StatusPill from '@/domain/Resource/StatusPill.vue'
import ResourceScreen from '@/domain/Resource/ResourceScreen.vue'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: vi.fn(),
  },
}))

vi.mock('@/domain/Shell/UseFleet', async () => {
  const { ref } = await import('vue')
  return {
    useFleet: () => ({ working: { length: 0 }, live: ref(0) }),
    isWorking: () => false,
  }
})

function serve(sessions: { running: number; cap: number } | null): void {
  read.mockImplementation((path: string) => {
    const answers: Record<string, unknown> = {
      '/api/machine': {
        available: true,
        reason: null,
        snapshot: { cpuPercent: 10, memoryUsedMb: 1000, memoryFreeMb: 64000, diskPercent: 10, loadAverage: 1 },
        sessions,
      },
      '/api/settings/budget': { policy: { capUsd: 100 }, spentUsd: 0 },
      '/api/fleet': { jobs: [], roster: null },
      '/api/stories/backlog': [],
    }
    return Promise.resolve(answers[path])
  })
}

async function roomOf(component: object, selector: string): Promise<string> {
  const screen = mount(component, { global: { plugins: [createBoardI18n('en')] } })
  await flushPromises()
  return screen.get(selector).text()
}

beforeEach(() => {
  read.mockReset()
})

describe('the room for more sessions', () => {
  it('is the same number on the status pill and on the Resources screen, capped by the dispatcher', async () => {
    serve({ running: 3, cap: 5 })

    const bar = await roomOf(StatusPill, '[data-test="status-room"]')
    const screen = await roomOf(ResourceScreen, '[data-test="resource-room"]')

    expect(bar).toBe('Room for 2 more sessions')
    expect(screen).toBe(bar)
  })

  it('says the machine is full on both when the dispatcher is saturated', async () => {
    serve({ running: 5, cap: 5 })

    const bar = await roomOf(StatusPill, '[data-test="status-room"]')
    const screen = await roomOf(ResourceScreen, '[data-test="resource-room"]')

    expect(bar).toBe(screen)
    expect(bar).not.toContain('Room for')
  })
})
