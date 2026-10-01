import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { ProjectAutopilot } from '@contract/AutopilotContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import AutopilotBadge from '@/domain/Workflow/AutopilotBadge.vue'
import AutopilotSection from '@/domain/Workflow/AutopilotSection.vue'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

let current: ProjectAutopilot
let wrapper: VueWrapper | null = null

beforeEach(() => {
  read.mockReset()
  send.mockReset()
  current = { enabled: true, autoLaunch: true, autoPublish: true, autoMerge: false, maySettle: true }
  read.mockImplementation(() => Promise.resolve(current))
  send.mockImplementation((_path: string, _method: string, body: Omit<ProjectAutopilot, 'maySettle'>) => {
    current = { ...body, maySettle: current.maySettle }
    return Promise.resolve({})
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function mountBadge(): Promise<VueWrapper> {
  wrapper = mount(AutopilotBadge, { props: { projectId: 3 }, global: { plugins: [createBoardI18n('en')] } })
  await flushPromises()
  return wrapper
}

describe('the auto badge', () => {
  it('shows the mode on and switches it off with the whole settings body', async () => {
    const badge = await mountBadge()

    expect(badge.get('button').attributes('aria-checked')).toBe('true')
    expect(badge.text()).toContain('auto')
    await badge.get('button').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/3/autopilot', 'PUT', {
      enabled: false,
      autoLaunch: true,
      autoPublish: true,
      autoMerge: false,
    })
    expect(badge.get('button').attributes('aria-checked')).toBe('false')
  })

  it('is locked for someone who is not the project admin', async () => {
    current = { ...current, maySettle: false }

    const badge = await mountBadge()

    expect(badge.get('button').attributes('disabled')).toBeDefined()
    await badge.get('button').trigger('click')
    expect(send).not.toHaveBeenCalled()
  })
})

describe('the automation section', () => {
  it('lists the four switches with auto-merge off by default', async () => {
    wrapper = mount(AutopilotSection, { props: { projectId: 3 }, global: { plugins: [createBoardI18n('en')] } })
    await flushPromises()

    const boxes = wrapper.findAll('input[type="checkbox"]').map((box) => (box.element as HTMLInputElement).checked)
    expect(boxes).toEqual([true, true, true, false])
  })

  it('turns auto-merge on without touching the other switches', async () => {
    wrapper = mount(AutopilotSection, { props: { projectId: 3 }, global: { plugins: [createBoardI18n('en')] } })
    await flushPromises()

    await wrapper.get('[data-test="autopilot-autoMerge"]').trigger('change')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/3/autopilot', 'PUT', {
      enabled: true,
      autoLaunch: true,
      autoPublish: true,
      autoMerge: true,
    })
  })

  it('has the same keys in every language', async () => {
    for (const locale of ['en', 'fr', 'de', 'it', 'pt', 'es', 'zh'] as const) {
      wrapper = mount(AutopilotSection, { props: { projectId: 3 }, global: { plugins: [createBoardI18n(locale)] } })
      await flushPromises()
      expect(wrapper.text()).not.toContain('autopilot.')
      wrapper.unmount()
      wrapper = null
    }
  })
})
