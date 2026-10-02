import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import StatusPill from '@/domain/Resource/StatusPill.vue'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: { read: (...args: unknown[]) => read(...(args as [string])), send: vi.fn() },
}))

vi.mock('@/domain/Resource/ResourceScreen.vue', () => ({
  default: { template: '<p>resource-content</p>' },
}))

function serve(cpuPercent: number, running: number): void {
  read.mockImplementation((path: string) => {
    const answers: Record<string, unknown> = {
      '/api/machine': {
        available: true,
        reason: null,
        snapshot: { cpuPercent, memoryUsedMb: 1000, memoryFreeMb: 64000, diskPercent: 10, loadAverage: 1 },
        sessions: { running, cap: 5 },
      },
      '/api/settings/budget': { policy: { capUsd: 20 }, spentUsd: 3.4 },
      '/api/fleet': { jobs: [], roster: null },
    }
    return Promise.resolve(answers[path])
  })
}

async function mounted() {
  const wrapper = mount(StatusPill, { attachTo: document.body, global: { plugins: [createBoardI18n('en')] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  read.mockReset()
  document.body.innerHTML = ''
})

describe('the status pill', () => {
  it('holds the sessions, the budget and the room left in one button', async () => {
    serve(12, 1)

    const pill = (await mounted()).get('[data-test="resource-status"]')

    expect(pill.text()).toContain('1 agent')
    expect(pill.text()).toContain('3.40 / 20.00 $')
    expect(pill.get('[data-test="status-room"]').text()).toBe('Room for 4 more sessions')
    expect(pill.find('.bg-green').exists()).toBe(true)
  })

  it('turns red and says the machine is full when the dispatcher is saturated', async () => {
    serve(12, 5)

    const pill = (await mounted()).get('[data-test="resource-status"]')

    expect(pill.find('.bg-red').exists()).toBe(true)
    expect(pill.text()).toContain('Full')
  })

  it('opens the resource details in a drawer', async () => {
    serve(12, 1)
    const wrapper = await mounted()

    await wrapper.get('[data-test="resource-status"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-test="resource-drawer"]')?.textContent).toContain('resource-content')
    wrapper.unmount()
  })
})
